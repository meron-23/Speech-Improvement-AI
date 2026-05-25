import asyncio
import websockets

api_key = "a3d79ef2e476266b13409c0a388c571648777fa1"

async def test_websocket_protocol():
    url = f"wss://api.deepgram.com/v1/listen?model=general"
    try:
        async with websockets.connect(url, subprotocols=["token", api_key]) as ws:
            print("Connected using subprotocol!")
            await ws.close()
    except Exception as e:
        print(f"Failed using subprotocol: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_protocol())
