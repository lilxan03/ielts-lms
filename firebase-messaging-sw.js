importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// ⚠️ IMPORTANT: Paste your Firebase Config here. 
// It MUST match the config in your main HTML file!
firebase.initializeApp({
  apiKey: "AIzaSyDqiWcuRrj6s5nNr1NvMSnYk5DyQYNr89E",
  authDomain: "khanh-ielts-v2.firebaseapp.com",
  projectId: "khanh-ielts-v2",
  storageBucket: "khanh-ielts-v2.firebasestorage.app",
  messagingSenderId: "1045761879860",
  appId: "1:1045761879860:web:09bb16937630369e887f61"
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