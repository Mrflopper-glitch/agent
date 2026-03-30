import asyncio
import logging
from config import POLL_INTERVAL
from whatsapp_bridge import WhatsAppBridge

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting local Mac agent...")
    
    bridge = WhatsAppBridge()
    
    try:
        await bridge.start_session()
        await bridge.open_self_chat()
        
        while True:
            # Main agent event loop
            message = await bridge.get_new_messages()
            if message:
                logger.info(f"Received new command: {message}")
                
                # Temporary placeholder: echo the message back so the user can verify it works
                await bridge.send_reply(f"Acknowledged: {message}")
                
            await asyncio.sleep(POLL_INTERVAL)
            
    except asyncio.CancelledError:
        logger.info("Agent shut down gracefully.")
    except Exception as e:
        logger.error(f"Agent crashed: {e}")
    finally:
        await bridge.stop_session()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Agent shut down safely via KeyboardInterrupt.")
