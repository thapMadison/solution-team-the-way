// Firebase Configuration
// PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "solution-team-requests.firebaseapp.com",
  databaseURL: "https://solution-team-requests-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "solution-team-requests",
  storageBucket: "solution-team-requests.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();

// Firebase API helper functions
const FirebaseAPI = {
  // Create new request
  async createRequest(requestData) {
    const ref = database.ref('requests');
    const newRequestRef = ref.push();
    await newRequestRef.set(requestData);
    return newRequestRef.key;
  },

  // Get all requests
  async getAllRequests() {
    const snapshot = await database.ref('requests').once('value');
    const data = snapshot.val();

    if (!data) return [];

    // Convert object to array
    return Object.keys(data).map(key => ({
      firebaseId: key,
      ...data[key]
    }));
  },

  // Listen to real-time updates
  onRequestsChange(callback) {
    database.ref('requests').on('value', (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        callback([]);
        return;
      }

      // Convert to array
      const requests = Object.keys(data).map(key => ({
        firebaseId: key,
        ...data[key]
      }));

      callback(requests);
    });
  },

  // Update request
  async updateRequest(firebaseId, updates) {
    const ref = database.ref(`requests/${firebaseId}`);
    await ref.update(updates);
  },

  // Delete request
  async deleteRequest(firebaseId) {
    const ref = database.ref(`requests/${firebaseId}`);
    await ref.remove();
  },

  // Get single request
  async getRequest(firebaseId) {
    const snapshot = await database.ref(`requests/${firebaseId}`).once('value');
    return snapshot.val();
  }
};
