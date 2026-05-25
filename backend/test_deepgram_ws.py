import asyncio
import websockets

api_key = "a3d79ef2e476266b13409c0a388c571648777fa1"

async def test_websocket_access_token():
    url = f"wss://api.deepgram.com/v1/listen?access_token={api_key}&model=general"
    try:
        async with websockets.connect(url) as ws:
            print("Connected using access_token in URL!")
            await ws.close()
    except Exception as e:
        print(f"Failed using access_token in URL: {e}")

async def test_websocket_token():
    url = f"wss://api.deepgram.com/v1/listen?token={api_key}&model=general"
    try:
        async with websockets.connect(url) as ws:
            print("Connected using token in URL!")
            await ws.close()
    except Exception as e:
        print(f"Failed using token in URL: {e}")

async def test_websocket_header():
    url = f"wss://api.deepgram.com/v1/listen?model=general"
    headers = {"Authorization": f"Token {api_key}"}
    try:
        async with websockets.connect(url, extra_headers=headers) as ws:
            print("Connected using Authorization header!")
            await ws.close()
    except Exception as e:
        print(f"Failed using Authorization header: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_access_token())
    asyncio.run(test_websocket_token())
    asyncio.run(test_websocket_header())
