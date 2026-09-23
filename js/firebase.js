import "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js";

const firebaseConfig = {
    apiKey: "AIzaSyDPOKWNoJw1gfndhYKeNoTjQTUYMogs3lk",
    authDomain: "greslyn-wit.firebaseapp.com",
    projectId: "greslyn-wit",
    storageBucket: "greslyn-wit.firebasestorage.app",
    messagingSenderId: "391217502718",
    appId: "1:391217502718:web:33cb102347f6548ce488af"
};

let dbInstance = null;
let usaFirebaseFlag = false;

try {
    firebase.initializeApp(firebaseConfig);
    dbInstance = firebase.firestore();
    usaFirebaseFlag = true;
} catch (e) {
    console.error("Error conectando Firebase:", e);
}

export const db = dbInstance;
export const usaFirebase = usaFirebaseFlag;