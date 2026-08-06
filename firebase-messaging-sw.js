importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// ⚠️ IMPORTANT: Paste your Firebase Config here. 
// It MUST match the config in your main HTML file!
firebase.initializeApp({
  apiKey: "AIzaSyC9XmnannGOWSltRQ4ZX_ER_2kNH4MPpSw",
  authDomain: "khanh-ielts.firebaseapp.com",
  projectId: "khanh-ielts",
  storageBucket: "khanh-ielts.firebasestorage.app",
  messagingSenderId: "448190151769",
  appId: "1:448190151769:web:2ce1fc076e48d4a70a0548"
});

const messaging = firebase.messaging();

// Handles background notifications when the user is NOT looking at the app
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png', // Add a path to your app logo here
    badge: '/icon-192x192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Focus the window if they click the notification
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});