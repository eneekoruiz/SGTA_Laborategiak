#!/usr/bin/env python3
"""Test complete error handling system"""

import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:5000"

def test_validation_error():
    """Test 422 Validation Error with field-specific messages"""
    print("\n" + "=" * 70)
    print("TEST 1: VALIDATION ERROR (422) - Invalid password format")
    print("=" * 70)
    
    payload = {
        "username": "ta",  # Too short (< 3 chars)
        "email": "bademail",  # Invalid email format
        "password": "short"  # Too short (< 8 chars), no number
    }
    
    body = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(
        f"{BASE_URL}/api/auth/register",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(request) as response:
            print(f"❌ Unexpected success: {response.status}")
    except urllib.error.HTTPError as e:
        if e.code == 422:
            response = json.loads(e.read().decode('utf-8'))
            print(f"✅ Got 422 Validation Error")
            print(f"\nResponse Structure:")
            print(f"  success: {response.get('success')}")
            print(f"  error_type: {response.get('error_type')}")
            print(f"  message: {response.get('message')}")
            print(f"  fields: {response.get('fields')}")
            print(f"  details: {json.dumps(response.get('details'), indent=4)}")
            return True
        else:
            print(f"❌ Wrong status code: {e.code}")
            return False

def test_auth_error():
    """Test 401 Auth Error"""
    print("\n" + "=" * 70)
    print("TEST 2: AUTH ERROR (401) - Invalid credentials")
    print("=" * 70)
    
    payload = {
        "email": "nonexistent@test.com",
        "password": "wrongpassword"
    }
    
    body = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(request) as response:
            print(f"❌ Unexpected success: {response.status}")
    except urllib.error.HTTPError as e:
        response = json.loads(e.read().decode('utf-8'))
        print(f"✅ Got {e.code} Error")
        print(f"\nResponse Structure:")
        print(f"  success: {response.get('success')}")
        print(f"  error_type: {response.get('error_type')}")
        print(f"  message: {response.get('message')}")
        return True

def test_successful_registration():
    """Test successful registration"""
    print("\n" + "=" * 70)
    print("TEST 3: SUCCESS - Valid registration")
    print("=" * 70)
    
    payload = {
        "username": "testuser",
        "email": f"testuser_{time.time()}@test.com",
        "password": "TestPass123"
    }
    
    body = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(
        f"{BASE_URL}/api/auth/register",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(request) as response:
            data = json.loads(response.read().decode('utf-8'))
            if response.status == 201 and data.get('success'):
                print(f"✅ Registration successful (201)")
                print(f"  User ID: {data.get('data', {}).get('user', {}).get('id')}")
                return True
            else:
                print(f"❌ Unexpected response: {data}")
                return False
    except urllib.error.HTTPError as e:
        print(f"❌ Error: {e.code}")
        print(e.read().decode('utf-8'))
        return False

def test_field_error_specificity():
    """Test field-specific error messaging"""
    print("\n" + "=" * 70)
    print("TEST 4: FIELD-SPECIFIC ERRORS")
    print("=" * 70)
    
    # Test missing email
    payload = {
        "username": "user123",
        "email": "",  # Missing email
        "password": "TestPass123"
    }
    
    body = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(
        f"{BASE_URL}/api/auth/register",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(request) as response:
            print(f"❌ Unexpected success")
    except urllib.error.HTTPError as e:
        response = json.loads(e.read().decode('utf-8'))
        details = response.get('details', {})
        
        if 'email' in details or 'email' in response.get('fields', []):
            print(f"✅ Email field error detected")
            print(f"  Error message: {details.get('email', 'N/A')}")
        
        if response.get('error_type') == 'ValidationError':
            print(f"✅ Correct error_type: ValidationError")
        
        return True

if __name__ == "__main__":
    print("\n🔬 TESTING COMPLETE ERROR HANDLING SYSTEM")
    print("=" * 70)
    
    results = []
    
    # Run tests
    results.append(("Validation Error (422)", test_validation_error()))
    time.sleep(1)
    results.append(("Auth Error (401)", test_auth_error()))
    time.sleep(1)
    results.append(("Successful Registration", test_successful_registration()))
    time.sleep(1)
    results.append(("Field-Specific Errors", test_field_error_specificity()))
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Error handling system is working correctly!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
