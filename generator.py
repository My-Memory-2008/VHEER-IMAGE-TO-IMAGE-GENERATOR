import os
import sys
from playwright.sync_api import sync_playwright

def run_automation():
    prompt_text = os.getenv("PROMPT_TEXT", "remove the jacket")
    image_file = os.getenv("DETECTED_IMAGE_FILE")
    auth_state_raw = os.getenv("VHEER_AUTH_STATE", "").strip()
    
    auth_state_path = "state.json"
    
    if auth_state_raw:
        print("Authentication state signature found! Injecting cookies...")
        with open(auth_state_path, "w", encoding="utf-8") as f:
            f.write(auth_state_raw)
            
    if not image_file or not os.path.exists(image_file):
        print(f"Error: Target image file '{image_file}' not found in the root directory.")
        sys.exit(1)

    with sync_playwright() as p:
        print("Launching Chromium Instance with custom profiles...")
        browser = p.chromium.launch(headless=False)
        
        has_state = os.path.exists(auth_state_path)
        context = browser.new_context(
            storage_state=auth_state_path if has_state else None,
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        
        page = context.new_page()

        # ========================================================
        # ANTI-ADVERTISING & ROUTING LAYER
        # ========================================================
        print("Activating Network Ad-Blocking Filter...")
        
        def block_trackers(route):
            url = route.request.url.lower()
            # Explicit blocklist patterns for trackers, pixels, ads, and sync engines
            block_keywords = [
                "temu", "opera", "amazon-adsystem", "ezoic", "google-analytics",
                "doubleclick", "facebook.net", "pixel", "sync", "adx", "lijit",
                "eskimi", "smaato", "rlcdn", "inmobi", "anyrtb", "rakuten", "onetag"
            ]
            
            if any(keyword in url for keyword in block_keywords):
                # Instantly drop the network frame at the socket layer
                route.abort()
            else:
                route.continue_()

        # Intercept all incoming global traffic patterns
        page.route("**/*", block_trackers)

        print("Navigating to Vheer App Workspace...")
        page.goto("https://vheer.com/app/image-to-image", wait_until="commit")
        
        print("Waiting for page DOM container structures to become interactive...")
        page.wait_for_selector("body", timeout=60000)
        page.wait_for_timeout(3000)

        print(f"Injecting input repository image asset: {image_file}")
        file_input = page.locator('input[type="file"]')
        if file_input.count() > 0:
            file_input.set_input_files(image_file)
        else:
            page.set_input_files('input[type="file"]', image_file)
        page.wait_for_timeout(3000)

        print(f"Filling generation prompt: '{prompt_text}'")
        prompt_box = page.locator('textarea, input[placeholder*="Describe"], [role="textbox"]')
        prompt_box.first.click()
        prompt_box.first.fill(prompt_text)
        page.wait_for_timeout(1500)

        # ========================================================
        # EVENT MONITORING SYSTEM ACTIVATION (NETWORK RESPONSE)
        # ========================================================
        print("Arming Network Stream Monitor for background generation completion...")
        
        def response_filter(response):
            url = response.url
            status = response.status
            content_type = response.headers.get("content-type", "")
            return status == 200 and (
                "api" in url or "predict" in url or "vheer" in url or "image/" in content_type
            )

        print("Clicking Generate trigger button...")
        page.locator('button:has-text("Generate")').first().click()
        
        try:
            page.wait_for_response(response_filter, timeout=240000)
            print("Image generation network event intercepted successfully!")
        except Exception as e:
            print(f"Warning: Network response tracking hit exception or resolved: {e}")

        # ========================================================
        # UI ELEMENT STABILISATION AND OS DOWNLOAD ENGINE
        # ========================================================
        print("Locating download elements in viewport canvas...")
        download_element = page.locator('button:has-text("Download"), [aria-label*="Download"], [class*="download"]').first
        download_element.wait_for(state="visible", timeout=120000)
        
        print("Clicking download element and awaiting browser download stream response...")
        with page.expect_download() as download_info:
            download_element.click()
            
        download = download_info.value
        save_destination = os.path.join("output", download.suggested_filename)
        download.save_as(save_destination)
        
        print(f"Pipeline successfully completed! File written onto disk: {save_destination}")
        
        context.close()
        browser.close()

if __name__ == "__main__":
    run_automation()
