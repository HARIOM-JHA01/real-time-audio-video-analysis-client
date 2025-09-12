// WebSocket Connection Test
// Run this in your browser console to test the WebSocket connection

console.log('🧪 Testing WebSocket Connection...');

const testUrl = 'wss://projects.aux-rolplay.com/real-time-audio-video-analysis';

console.log('URL:', testUrl);
console.log('Browser:', navigator.userAgent);
console.log('Location:', window.location.href);
console.log('Protocol:', window.location.protocol);

// Test 1: Basic fetch to domain
console.log('\n📡 Testing domain reachability...');
fetch('https://projects.aux-rolplay.com', { mode: 'no-cors' })
    .then(() => console.log('✅ Domain is reachable'))
    .catch(e => console.log('❌ Domain unreachable:', e));

// Test 2: WebSocket connection
console.log('\n🔌 Testing WebSocket connection...');
const ws = new WebSocket(testUrl);

ws.onopen = (event) => {
    console.log('✅ WebSocket connected successfully!', event);
    ws.close();
};

ws.onclose = (event) => {
    console.log('🔌 WebSocket closed. Code:', event.code, 'Reason:', event.reason);
    if (event.code === 1006) {
        console.log('❌ Code 1006 = Connection closed abnormally (server not responding)');
    }
};

ws.onerror = (error) => {
    console.log('❌ WebSocket error:', error);
};

// Test 3: Alternative connection attempts
setTimeout(() => {
    console.log('\n🔄 Testing with different approaches...');

    // Try without sub-protocols
    const ws2 = new WebSocket(testUrl);
    ws2.onopen = () => {
        console.log('✅ Alternative connection successful!');
        ws2.close();
    };
    ws2.onerror = () => console.log('❌ Alternative connection failed');

}, 2000);

console.log('\n⏳ Running tests... Check console for results.');