import os
from google import genai
from google.genai import types
from dotenv import load_dotenv
import re
import requests
from bs4 import BeautifulSoup, PageElement
from moviepy import VideoFileClip, concatenate_videoclips

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GENAI_API_KEY")
)
model = "gemini-2.5-flash-lite"
sasl_generate_content_config = types.GenerateContentConfig(
    temperature=0,
    top_p=0,
    response_mime_type="application/json",
    response_schema=genai.types.Schema(
        type = genai.types.Type.OBJECT,
        required = ["asl-syntax-translation"],
        properties = {
            "asl-syntax-translation": genai.types.Schema(
                type = genai.types.Type.STRING,
            ),
        },
    ),
    system_instruction=[
        types.Part.from_text(text="""Convert the string to the syntactical structure of ASL. For example, if the string said \"I am going to the park\", your response would be \"I go park\", and \"What time is it?\" would be \"Time what?\". If there are any proper nouns that need to be spelled out, separate each letter with a space. Don't include words like \"is\" unless nessecary. For example \"My name is Tom\" becomes \"My name T O M\"."""),
    ],
)
hnym_generate_content_config = types.GenerateContentConfig(
    temperature=0,
    top_p=0,
    response_mime_type="application/json",
    response_schema=genai.types.Schema(
        type = genai.types.Type.OBJECT,
        required = ["matching-definition-index"],
        properties = {
            "matching-definition-index": genai.types.Schema(
                type = genai.types.Type.INTEGER,
            ),
        },
    )
)

def string_to_asl_syntax(english_str: str):
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=english_str),
            ],
        ),
    ]

    output_content: str = client.models.generate_content(
        model=model,
        contents=contents,
        config=sasl_generate_content_config,
    ).parsed["asl-syntax-translation"]
    
    output_content = output_content.strip().upper().replace("\n", " ")
    output_content = re.sub(r'[^a-zA-Z\s]', '', output_content)
    if not output_content.endswith("."):
        output_content = output_content + "."

    return output_content

def clarify_homonym_definition(
        words_in_sentence: list[str], 
        word_index: int, 
        definition_possibilities: list[str]
    ):
    are_there_duplicates = False
    total_duplicate_count = 0
    which_duplicate = 0
    for idx, word in enumerate(words_in_sentence):
        if word == words_in_sentence[word_index]:
            total_duplicate_count += 1
        if idx == word_index:
            which_duplicate = total_duplicate_count + 1
            if which_duplicate > 1:
                are_there_duplicates = True
            break
    if not are_there_duplicates:
        word_intro_string = "In this sentence, the word "
    else:
        if which_duplicate == 0:
            word_intro_string = "In this sentence, the 1st instance of the word"
        if which_duplicate == 1:
            word_intro_string = "In this sentence, the 2nd instance of the word"
        if which_duplicate == 2:
            word_intro_string = "In this sentence, the 3rd instance of the word"
        else:
            word_intro_string = f"In this sentence, the {which_duplicate}th instance of the word"
    formatted_definition_choice_list = ""
    for idx, definition in enumerate(definition_possibilities):
        formatted_definition_choice_list += f"[{idx}] {definition}\n"
    prompt = f"""\
The following is a sentence, which is a segment of a transcription of an ASL conversation: {" ".join(words_in_sentence)}
{word_intro_string} "{words_in_sentence[word_index]}" has multiple definitions. The definition is one of the following:
```
{formatted_definition_choice_list}
```
Return the index of the definition that most closely matches the word as it's used in the sentence. If it's ambiguous, make an educated guess.\
"""
    
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]

    output_content: str = client.models.generate_content(
        model=model,
        contents=contents,
        config=hnym_generate_content_config,
    ).parsed["matching-definition-index"]
    
    return int(output_content)

def get_sign_video_link_from_sentence(words_in_sentence: list[str], word_index: int):
    this_word = words_in_sentence[word_index]
    this_html_doc = requests.get(f"https://www.signasl.org/sign/{this_word.lower()}").text
    this_soup = BeautifulSoup(this_html_doc, 'html.parser')
    target_div = this_soup.find("div", class_="col-md-12")
    homonym_divs = []
    if target_div:
        for child in target_div.children:
            if getattr(child, "name", None) == "h1" and child.get_text(strip=True).upper() == this_word:
                homonym_divs.append(child)
            if getattr(child, "name", None) == "h2" and child.get_text(strip=True).upper() == this_word:
                homonym_divs.append(child)
    else:
        print(this_word)
        with open('test.html', 'w') as f:
            f.write(this_html_doc)
        return "https://placehold.co/600x400"
    if len(homonym_divs) == 0:
        return
    if len(homonym_divs) > 1:
        possible_definitions = []
        for child in homonym_divs:
            p_element = child.find_next_sibling("p")
            if p_element:
                if p_element.contents.__len__() > 1:
                    if p_element.contents[1].strip():
                        possible_definitions.append(
                            p_element.contents[1].strip()
                        )
        n = clarify_homonym_definition(words_in_sentence, word_index, possible_definitions)

        children: list[PageElement] = [child for child in target_div.children]
        homonym_indices = [
            idx for idx, child in enumerate(children)
            if (getattr(child, "name", None) == "h1" or getattr(child, "name", None) == "h2") and child.get_text(strip=True).upper() == this_word
        ]
        start_idx = homonym_indices[n]
        end_idx = homonym_indices[n+1] if n+1 < len(homonym_indices) else len(children)
        new_div = BeautifulSoup('<div class="col-md-12"></div>', 'html.parser').div
        for child in children[start_idx:end_idx]:
            new_div.append(child)
        target_div = new_div
    
    for child in target_div.find_all("source"):
        if "src" in child.attrs.keys():
            return child.attrs.get("src")
    
def sentence_to_links(sentence: str):
    words_in_sentence = string_to_asl_syntax(sentence)
    words_in_sentence = re.sub(r'[^a-zA-Z\s]', '', words_in_sentence).split(" ")

    sign_links = []
    for i in range(words_in_sentence.__len__()):
        sign_links.append(
            get_sign_video_link_from_sentence(words_in_sentence, i)
        )
    return sign_links

def stitch_videos(urls, output_filename="stitched_video.mp4"):
    """
    Downloads videos from a list of URLs and stitches them into a single MP4 file.

    Args:
        urls (list): A list of strings, where each string is a URL to an MP4 file.
        output_filename (str): The name of the output MP4 file.
    """
    if not urls:
        print("Error: The URL list is empty.")
        return

    temp_dir = "temp_videos"
    os.makedirs(temp_dir, exist_ok=True)
    
    video_clips = []
    
    try:
        print("Downloading videos...")
        for i, url in enumerate(urls):
            temp_path = os.path.join(temp_dir, f"video_{i}.mp4")
            try:
                # Download the video file
                response = requests.get(url, stream=True)
                response.raise_for_status() # Raise an exception for bad status codes
                
                with open(temp_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                print(f"Downloaded video from {url}")
                
                # Create a moviepy video clip from the downloaded file
                clip = VideoFileClip(temp_path).resized((960, 540))
                video_clips.append(clip)
            except requests.exceptions.RequestException as e:
                print(f"Failed to download video from {url}: {e}")
            except Exception as e:
                print(f"An error occurred with video {url}: {e}")

        if not video_clips:
            print("No videos were successfully downloaded or loaded. Exiting.")
            return

        print("\nStitching videos together...")
        final_clip = concatenate_videoclips(video_clips)
        
        print("Saving the final video...")
        final_clip.write_videofile(output_filename, codec="libx264", audio_codec="aac")
        
        print(f"\nSuccess! The stitched video is saved as '{output_filename}'")
        
    finally:
        # Close the clips and clean up temporary files
        for clip in video_clips:
            clip.close()
        
        # Clean up temporary files
        if os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)
            print(f"Cleaned up temporary directory '{temp_dir}'")

def sentence_to_video(sentence: str):
    video_title = sentence.lower()
    video_title = re.sub(r'[^a-zA-Z\s]', '', sentence)
    video_title = video_title.replace(" ", "_")
    video_title = "out/" + video_title + ".mp4"
    
    stitch_videos(sentence_to_links(sentence), video_title)

if __name__ == "__main__":
    with open('scraper/sentences_to_translate.txt', 'r') as f:
        sentences_to_translate = f.read()
    sentences_to_translate = sentences_to_translate.split('\n')
    for sentence in sentences_to_translate:
        sentence_to_video(sentence)