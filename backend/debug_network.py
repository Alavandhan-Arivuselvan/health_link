
import socket
import psutil

def get_ip_info():
    print("--- Default Route IP ---")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        print(f"Detected IP (used in app): {local_ip}")
    except Exception as e:
        print(f"Error detecting default IP: {e}")

    print("\n--- All Network Interfaces ---")
    for interface, snics in psutil.net_if_addrs().items():
        print(f"Interface: {interface}")
        for snic in snics:
            if snic.family == socket.AF_INET:
                print(f"  - IPv4 Address: {snic.address}")
                
if __name__ == "__main__":
    get_ip_info()
