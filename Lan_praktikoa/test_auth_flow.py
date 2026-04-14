#!/usr/bin/env python3
"""Test authentication flow with fixed EMAIL field"""

import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:5000"

def make_request(method, path, data=None):
    """Make HTTP request"""
    url = f"{BASE_URL}{path}"
    headers = {
        "Content-Type": "application/json"
    }
    
    body = None
    if data:
        body = json.dumps(data).encode('utf-8')
    
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(request) as response:
            content = response.read().decode('utf-8')
            return response.status, json.loads(content)
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8')
        try:
            return e.code, json.loads(content)
        except:
            return e.code, {"error": content}

def test_registration():
    """Test user registration"""
    print("=" * 70)
    print("TEST 1: Register new user")
    print("=" * 70)
    
    payload = {
        "username": "testflow2",
        "email": "testflow2@example.com",
        "password": "TestPass123"
    }
    
    status, response = make_request("POST", "/api/auth/register", payload)
    
    print(f"Status: {status}")
    print(f"Response: {json.dumps(response, indent=2)}")
    
    if status == 201:
        print("✅ Registration successful!")
        return response
    else:
        print("❌ Registration failed!")
        return None

def test_login():
    """Test login with EMAIL field (NOT username)"""
    print("\n" + "=" * 70)
    print("TEST 2: Login with EMAIL field")
    print("=" * 70)
    
    payload = {
        "email": "testflow2@example.com",
        "password": "TestPass123"
    }
    
    status, response = make_request("POST", "/api/auth/login", payload)
    
    print(f"Status: {status}")
    print(f"Response: {json.dumps(response, indent=2)}")
    
    if status == 200:
        print("✅ Login successful!")
        return response
    else:
        print("❌ Login failed!")
        return None

def test_profile(token):
    """Test accessing protected endpoint"""
    print("\n" + "=" * 70)
    print("TEST 3: Access protected /profile endpoint")
    print("=" * 70)
    
    url = f"{BASE_URL}/api/auth/profile"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    request = urllib.request.Request(url, headers=headers, method="GET")
    
    try:
        with urllib.request.urlopen(request) as response:
            content = response.read().decode('utf-8')
            data = json.loads(content)
            status = response.status
    except urllib.error.HTTPError as e:
        status = e.code
        content = e.read().decode('utf-8')
        try:
            data = json.loads(content)
        except:
            data = {"error": content}
    
    print(f"Status: {status}")
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if status == 200:
        print("✅ Profile access successful!")
        return data
    else:
        print("❌ Profile access failed!")
        return None

if __name__ == "__main__":
    print("\n🔧 AUTHENTICATION FLOW TEST\n")
    
    # Test registration
    reg_result = test_registration()
    time.sleep(1)
    
    # Test login with email
    login_result = test_login()
    time.sleep(1)
    
    # Test protected endpoint if login succeeded
    if login_result and "token" in login_result:
        test_profile(login_result["token"])
    
    print("\n" + "=" * 70)
    print("✅ TEST COMPLETE")
    print("=" * 70)
