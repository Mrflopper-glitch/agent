import asyncio
import logging
from playwright.async_api import async_playwright, Page, Playwright, BrowserContext
from config import BROWSER_PROFILE_DIR, SELF_CHAT_NAME

logger = logging.getLogger(__name__)

class WhatsAppBridge:
    def __init__(self):
        self.playwright: Playwright = None
        self.browser: BrowserContext = None
        self.page: Page = None
        self.last_seen_message = ""

    async def start_session(self):
        logger.info("Starting WhatsApp Web session via Playwright...")
        self.playwright = await async_playwright().start()
        
        # Use persistent context to save login state
        self.browser = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(BROWSER_PROFILE_DIR),
            headless=False, # Required false initially so user can scan QR
            channel="chrome" # Often works better for media/H264 on mac
        )
        
        if len(self.browser.pages) > 0:
            self.page = self.browser.pages[0]
        else:
            self.page = await self.browser.new_page()
            
        logger.info("Navigating to WhatsApp Web...")
        await self.page.goto("https://web.whatsapp.com/")
        
        logger.info("Waiting for WhatsApp Web to load. Scan the QR code if needed.")
        
        # Usually, waiting for `#pane-side` or the search box is reliable
        await self.page.wait_for_selector('div[title="Search input textbox"], div[contenteditable="true"][data-tab="3"]', timeout=300000)
        logger.info("WhatsApp Web loaded successfully.")

    async def open_self_chat(self):
        logger.info(f"Opening chat: {SELF_CHAT_NAME}")
        
        # Wait for chat list to load
        await asyncio.sleep(2)
        
        # First try finding it in the chat list directly if it's pinned
        try:
            chat_element = self.page.locator(f'span[title="{SELF_CHAT_NAME}"]').first
            if await chat_element.is_visible(timeout=2000):
                await chat_element.click()
                logger.info("Chat opened from list.")
                return
        except Exception:
            pass

        # Search for the chat
        search_box = self.page.locator('div[title="Search input textbox"], div[contenteditable="true"][data-tab="3"]').first
        await search_box.fill(SELF_CHAT_NAME)
        await asyncio.sleep(1) # Wait for animation/search results
        
        # Click the chat in the search results
        chat_element = self.page.locator(f'span[title="{SELF_CHAT_NAME}"]').first
        await chat_element.wait_for(state="visible")
        await chat_element.click()
        
        logger.info("Chat opened via search.")
        
        # Clear search using the X button
        clear_btn = self.page.locator('span[data-icon="x-alt"]').first
        if await clear_btn.is_visible():
            await clear_btn.click()

    async def get_new_messages(self) -> str:
        """Polls the chat for a new message. Returns empty string if no new message."""
        # This selector matches the inner span of messages containing the actual text
        message_elements = self.page.locator('div[data-pre-plain-text] span.selectable-text')
        count = await message_elements.count()
        if count == 0:
            return ""
            
        last_message_element = message_elements.nth(count - 1)
        text = await last_message_element.inner_text()
        
        if text and text != self.last_seen_message:
            self.last_seen_message = text
            return text
            
        return ""

    async def send_reply(self, text: str):
        logger.info(f"Sending reply: {text}")
        input_box = self.page.locator('div[contenteditable="true"][data-tab="10"], div[title="Type a message"]').first
        await input_box.wait_for(state="visible")
        await input_box.fill(text)
        await self.page.keyboard.press("Enter")
        # Update last seen to avoid echoing ourselves
        self.last_seen_message = text
        
    async def stop_session(self):
        logger.info("Closing Playwright session...")
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
