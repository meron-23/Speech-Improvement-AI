import os
import riva.client
from dotenv import load_dotenv

load_dotenv()

def test_riva():
    api_key = os.environ.get('NVIDIA_API_KEY')
    function_id = "d3fe9151-442b-4204-a70d-5fcc597fd610"
    
    if not api_key:
        print("Error: NVIDIA_API_KEY not found in .env")
        return

    print(f"Testing Riva gRPC connection...")
    print(f"Function ID: {function_id}")
    
    try:
        auth = riva.client.Auth(
            use_ssl=True,
            uri="grpc.nvcf.nvidia.com:443",
            metadata_args=[
                ["function-id", function_id],
                ["authorization", f"Bearer {api_key}"]
            ]
        )
        
        asr_service = riva.client.ASRService(auth)
        # Just try to get something or do a dummy call
        # offline_recognize needs audio. Let's send empty bytes just to see the error type.
        try:
            asr_service.offline_recognize(b'', riva.client.RecognitionConfig(language_code="en-US"))
        except Exception as e:
            print(f"Caught expected or unexpected error from Riva: {e}")
            
    except Exception as e:
        print(f"Failed to initialize Riva or connect: {e}")

if __name__ == "__main__":
    test_riva()
