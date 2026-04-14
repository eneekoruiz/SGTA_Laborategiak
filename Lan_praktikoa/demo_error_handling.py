#!/usr/bin/env python3
"""Visual demonstration of complete error handling system"""

import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:5000"

def print_response(title, status, response):
    """Pretty print API response"""
    print(f"\n{'='*70}")
    print(f"🔔 {title}")
    print(f"{'='*70}")
    print(f"HTTP Status: {status}")
    print(f"\nResponse JSON:")
    print(json.dumps(response, indent=2, ensure_ascii=False))

def demo_case_1():
    """Demo: User tries to login with invalid email"""
    print("\n\n" + "🎬 DEMO CASE 1: Invalid Email Format".center(70, "="))
    print("User enters: email='wrong@', password='TestPass123'")
    
    payload = {
        "email": "wrong@",
        "password": "TestPass123"
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
            pass
    except urllib.error.HTTPError as e:
        response = json.loads(e.read().decode('utf-8'))
        print_response("BACKEND RESPONSE", e.code, response)
        
        # Show how Frontend processes this
        print("\n" + "Frontend Processing".center(70, "-"))
        print(f"✅ Extracts error_type: {response.get('error_type')}")
        print(f"✅ Extracts message: {response.get('message')}")
        print(f"✅ Extracts fields: {response.get('fields')}")
        if response.get('details'):
            for field, msg in response['details'].items():
                print(f"   └─ {field}: {msg}")
        
        print("\n" + "UI Rendering".center(70, "-"))
        print("┌─ ErrorAlert Component ─────────────────────────────────┐")
        print(f"│ ❌ {response.get('message')}                              │")
        print(f"│    Eragengo eremuak: email                              │")
        print("└─────────────────────────────────────────────────────────┘")
        print("\n┌─ FormField: email ──────────────────────────────────────┐")
        print("│ Emaila                                                   │")
        print("│ [wrong@                                               🔴│ (red border)")
        print(f"│ ⚠️ {response['details'].get('email', 'N/A')}                    │")
        print("└─────────────────────────────────────────────────────────┘")

def demo_case_2():
    """Demo: User tries to register with weak password"""
    print("\n\n" + "🎬 DEMO CASE 2: Multiple Validation Errors".center(70, "="))
    print("User enters: username='ab', email='notanemail', password='123'")
    
    payload = {
        "username": "ab",
        "email": "notanemail",
        "password": "123"
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
            pass
    except urllib.error.HTTPError as e:
        response = json.loads(e.read().decode('utf-8'))
        print_response("BACKEND RESPONSE", e.code, response)
        
        # Show how Frontend processes this
        print("\n" + "Frontend Processing".center(70, "-"))
        affected = response.get('fields', [])
        details = response.get('details', {})
        
        print(f"✅ Multiple fields affected: {', '.join(affected)}")
        for field in affected:
            print(f"   └─ {field}: {details.get(field, 'N/A')}")
        
        print("\n" + "UI Rendering".center(70, "-"))
        print("┌─ ErrorAlert Component ─────────────────────────────────┐")
        print(f"│ ⚠️ {response.get('message')[:40]}...                  │")
        print(f"│    Eragengo eremuak: {', '.join(affected)}                      │")
        print("└─────────────────────────────────────────────────────────┘")
        
        for field in affected:
            print(f"\n┌─ FormField: {field} ──────────────────────────────────┐")
            print(f"│ {field.title():10}                                               │")
            if field == "username":
                print(f"│ [ab {' '*30}🔴│ (red border)")
            elif field == "email":
                print(f"│ [notanemail {' '*20}🔴│ (red border)")
            else:
                print(f"│ [123 {' '*30}🔴│ (red border)")
            print(f"│ ⚠️ {details.get(field, 'N/A')[:40]}...        │")
            print(f"└─────────────────────────────────────────────────────────┘")

def demo_case_3():
    """Demo: Successful registration (no errors)"""
    print("\n\n" + "🎬 DEMO CASE 3: Successful Registration".center(70, "="))
    print("User enters: username='testuser', email='test@example.com', password='TestPass123'")
    
    payload = {
        "username": f"testuser{int(time.time())}",
        "email": f"test{int(time.time())}@example.com",
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
            print_response("BACKEND RESPONSE", response.status, data)
            
            print("\n" + "Frontend Processing".center(70, "-"))
            print(f"✅ success: {data.get('success')}")
            print(f"✅ No error_type (success = true)")
            print(f"✅ No fields affected")
            
            print("\n" + "UI Rendering".center(70, "-"))
            print("┌─ ErrorAlert Component ─────────────────────────────────┐")
            print("│ (Hidden - no error)                                     │")
            print("└─────────────────────────────────────────────────────────┘")
            
            print("\n🎉 Successful! Redirect to /games")
            print(f"   User ID: {data.get('data', {}).get('user', {}).get('id')}")
            
    except urllib.error.HTTPError as e:
        print(f"❌ Unexpected error: {e.code}")

if __name__ == "__main__":
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " ERROR HANDLING SYSTEM - VISUAL DEMONSTRATION ".center(68) + "║")
    print("╚" + "="*68 + "╝")
    
    try:
        demo_case_1()
        time.sleep(2)
        
        demo_case_2()
        time.sleep(2)
        
        demo_case_3()
        
        print("\n\n" + "="*70)
        print("✅ DEMONSTRATION COMPLETE".center(70))
        print("="*70)
        print("\nSystem demonstrates:")
        print("  ✅ Validation errors with field mapping")
        print("  ✅ Basque language translations")
        print("  ✅ Structured error responses")
        print("  ✅ Field-specific error messages")
        print("  ✅ Multiple error aggregation")
        print("  ✅ Successful response handling")
        print("\n")
        
    except Exception as e:
        print(f"\n❌ Error during demo: {e}")
        import traceback
        traceback.print_exc()
