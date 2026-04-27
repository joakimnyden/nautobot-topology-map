import threading
import paramiko
import socket
import sys

# Generate an RSA key for the server
host_key = paramiko.RSAKey.generate(2048)

class MockSSHServer(paramiko.ServerInterface):
    def check_channel_request(self, kind, chanid):
        if kind == 'session':
            return paramiko.OPEN_SUCCEEDED
        return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

    def check_auth_password(self, username, password):
        # Accept any credentials
        return paramiko.AUTH_SUCCESSFUL

    def get_allowed_auths(self, username):
        return 'password'
        
    def check_channel_shell_request(self, channel):
        return True

    def check_channel_pty_request(self, channel, term, width, height, pixelwidth, pixelheight, modes):
        return True
        
def handle_client(client_sock):
    transport = paramiko.Transport(client_sock)
    transport.add_server_key(host_key)
    server = MockSSHServer()
    try:
        transport.start_server(server=server)
    except paramiko.SSHException:
        return
        
    channel = transport.accept(20)
    if channel is None:
        return
        
    # Send a prompt
    channel.send("Mock-Switch#")
    
    buf = ""
    while True:
        try:
            data = channel.recv(1024).decode('utf-8')
            if not data:
                break
            buf += data
            if '\r' in buf or '\n' in buf:
                cmd = buf.strip()
                buf = ""
                channel.send("\r\n")
                
                if "show lldp neighbors detail" in cmd:
                    channel.send("""
------------------------------------------------
Chassis id: 0011.2233.4455
Port id: GigabitEthernet1/0/1
Port Description: GigabitEthernet1/0/1
System Name: Core-Router-01

System Description:
Cisco IOS Software, C2960X Software (C2960X-UNIVERSALK9-M), Version 15.2(2)E6, RELEASE SOFTWARE (fc1)
Technical Support: http://www.cisco.com/techsupport
Copyright (c) 1986-2016 by Cisco Systems, Inc.
Compiled Fri 16-Dec-16 15:37 by prod_rel_team

Time remaining: 100 seconds
System Capabilities: B,R
Enabled Capabilities: B,R
Management Addresses:
    IP: 10.0.0.2
Auto Negotiation - supported, enabled
Physical media capabilities:
    1000baseT(FD)
    100base-TX(FD)
    10base-T(FD)
Media Attachment Unit type: 16
Vlan ID: 10

------------------------------------------------
Chassis id: 0011.2233.4466
Port id: TenGigabitEthernet2/0/1
Port Description: TenGigabitEthernet2/0/1
System Name: Access-Switch-02

System Description:
Cisco IOS Software, C2960X Software (C2960X-UNIVERSALK9-M)

Time remaining: 100 seconds
System Capabilities: B,R
Enabled Capabilities: B,R
Management Addresses:
    IP: 10.0.0.3
Auto Negotiation - supported, enabled
Physical media capabilities:
    1000baseT(FD)
Media Attachment Unit type: 16
Vlan ID: 20

Total entries displayed: 2
""")
                elif "exit" in cmd or "quit" in cmd:
                    break
                
                channel.send("\r\nMock-Switch#")
        except:
            break
            
    channel.close()
    transport.close()

def start_server(port=2222):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', port))
    sock.listen(100)
    print(f"Mock SSH server listening on port {port}...")
    
    while True:
        try:
            client, addr = sock.accept()
            print(f"Accepted connection from {addr}")
            t = threading.Thread(target=handle_client, args=(client,))
            t.daemon = True
            t.start()
        except KeyboardInterrupt:
            break

if __name__ == '__main__':
    start_server()
