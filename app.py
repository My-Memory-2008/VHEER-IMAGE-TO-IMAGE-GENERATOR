import streamlit as st
import requests
import json
import base64

# --- CONFIGURATION (Change these to match your repository) ---
GITHUB_OWNER = "YOUR_GITHUB_USERNAME"
GITHUB_REPO = "YOUR_REPO_NAME"
WORKFLOW_FILE = "vheer_runner.yml"  # The name of your workflow .yml file

st.set_page_config(page_title="Vheer AI Studio", layout="centered", page_icon="✨")

st.title("✨ Vheer AI Image-to-Image Studio")
st.write("Upload an image and write instructions. The automation engine will run in the cloud.")

# 1. User Interface Inputs
user_prompt = st.text_input("AI Generation Prompt", value="remove the jacket", help="Describe how you want to alter the image.")
uploaded_file = st.file_uploader("Choose an input image...", type=["jpg", "jpeg", "png", "webp"])

if uploaded_file is not None:
    st.image(uploaded_file, caption="Target Image Preview", width=300)

# 2. Trigger Action Button
if st.button("🚀 Start AI Generation Pipeline", type="primary"):
    if not user_prompt:
        st.error("Please enter a valid modification prompt instructions.")
    elif uploaded_file is None:
        st.error("Please upload an input image file first.")
    else:
        # Securely read your GitHub Token from Streamlit Secrets
        if "GH_TOKEN" not in st.secrets:
            st.error("Missing GitHub Access Token configuration in production environment.")
        else:
            TOKEN = st.secrets["GH_TOKEN"]
            headers = {
                "Authorization": f"token {TOKEN}",
                "Accept": "application/vnd.github.v3+json"
            }
            
            with st.spinner("Processing image upload and dispatching server cluster..."):
                try:
                    # A. Convert uploaded file to base64 to send via GitHub API
                    file_bytes = uploaded_file.getvalue()
                    encoded_content = base64.b64encode(file_bytes).decode('utf-8')
                    
                    # B. Push/Overwrite 'input-image.png' directly to your repository root via API
                    upload_url = f"https://github.com{GITHUB_OWNER}/{GITHUB_REPO}/contents/input-image.png"
                    
                    # Check if file already exists to get its SHA hash (required for replacing files in Git)
                    check_res = requests.get(upload_url, headers=headers)
                    sha = check_res.json().get("sha") if check_res.status_code == 200 else None
                    
                    upload_payload = {
                        "message": "Web UI Automation Upload",
                        "content": encoded_content,
                        "branch": "main"
                    }
                    if sha:
                        upload_payload["sha"] = sha
                        
                    put_res = requests.put(upload_url, headers=headers, json=upload_payload)
                    
                    if put_res.status_code not in:
                        st.error(f"Failed to stage image file asset to repository matrix: {put_res.text}")
                    else:
                        # C. Dispatch the GitHub Actions Workflow via Workflow Dispatch API
                        trigger_url = f"https://github.com{GITHUB_OWNER}/{GITHUB_REPO}/actions/workflows/{WORKFLOW_FILE}/dispatches"
                        trigger_payload = {
                            "ref": "main",
                            "inputs": {
                                "prompt": user_prompt
                            }
                        }
                        
                        run_res = requests.post(trigger_url, headers=headers, json=trigger_payload)
                        
                        if run_res.status_code == 204:
                            st.success("🎉 Pipeline successfully kicked off! The AI execution loop has started.")
                            st.info("Check your repository 'Actions' tab. Once completed, your new image will be ready inside the run artifacts.")
                        else:
                            st.error(f"Failed to dispatch workflow pipeline layer: {run_res.text}")
                            
                except Exception as e:
                    st.error(f"An unexpected boundary execution error occurred: {str(e)}")
