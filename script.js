const firebaseConfig = {
  apiKey: "AIzaSyBPq6Wfxzq02MfK69BFxHm9_FUjDGTmAcw",
  authDomain: "kykychat-24c7f.firebaseapp.com",
  databaseURL: "https://kykychat-24c7f-default-rtdb.firebaseio.com",
  projectId: "kykychat-24c7f",
  storageBucket: "kykychat-24c7f.firebasestorage.app",
  messagingSenderId: "342562811927",
  appId: "1:342562811927:web:0fed1e1f511c4fddcfec52"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentPopupCallback = null;

const balanceDiv = document.getElementById("balance");
const orgList = document.getElementById("orgList");
const onlineList = document.getElementById("onlineList");
const popup = document.getElementById("popup");
const popupInput = document.getElementById("popup-input");
const popupText = document.getElementById("popup-text");
const notif = document.getElementById("notification");
const sound = document.getElementById("notifSound");

auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (!userDoc.exists) {
      const pseudo = prompt("Choisis un pseudo unique :");
      await db.collection("users").doc(user.uid).set({ pseudo, balance: 50.00 });
      await user.updateProfile({ displayName: pseudo });
    }
    updateBalanceUI();
    updateOnlineStatus(true);
    listenToOnlineUsers();
    loadOrganisations();
    listenToNotifications();
  } else {
    const email = prompt("Email :");
    const pass = prompt("Mot de passe :");
    auth.signInWithEmailAndPassword(email, pass).catch(e => {
      alert("Erreur de connexion : " + e.message);
    });
  }
});

window.addEventListener("beforeunload", () => {
  updateOnlineStatus(false);
});

function updateOnlineStatus(state) {
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).update({ online: state });
  }
}

function updateBalanceUI() {
  db.collection("users").doc(currentUser.uid).get().then(doc => {
    const data = doc.data();
    balanceDiv.textContent = `Balance : ${data.balance.toFixed(2)}µ`;
  });
}

function showPopup(text, callback) {
  popup.classList.remove("hidden");
  popupText.textContent = text;
  popupInput.value = "";
  currentPopupCallback = callback;
}

function closePopup() {
  popup.classList.add("hidden");
  currentPopupCallback = null;
}

function confirmPopup() {
  if (currentPopupCallback) {
    currentPopupCallback(popupInput.value);
    closePopup();
  }
}

function showNotification(text) {
  notif.textContent = text;
  notif.classList.remove("hidden");
  sound.play();
  setTimeout(() => notif.classList.add("hidden"), 3000);
}

async function loadOrganisations() {
  orgList.innerHTML = "";
  const snap = await db.collection('organisations')
    .where('members', 'array-contains', currentUser.displayName).get();

  snap.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");

    div.innerHTML = `
      <strong>${data.name}</strong><br>
      Créé par: ${data.creator}<br>
      Balance: ${data.balance.toFixed(2)}µ<br>
      <button onclick="addMember('${doc.id}')">Ajouter un membre</button>
      <button onclick="recuperer('${doc.id}', ${data.balance})">Récupérer</button>
    `;

    orgList.appendChild(div);
  });
}

function addMember(orgId) {
  const newUser = prompt("Ajouter un utilisateur à cette organisation:");
  if (newUser) {
    db.collection('organisations').doc(orgId).update({
      members: firebase.firestore.FieldValue.arrayUnion(newUser)
    });
  }
}

async function recuperer(orgId, orgBalance) {
  const montantStr = prompt("Montant à récupérer (ex: 01,00µ)");
  if (!montantStr) return;
  const montant = parseFloat(montantStr.replace(",", "."));
  if (isNaN(montant) || montant <= 0) return alert("Montant invalide");

  const orgRef = db.collection('organisations').doc(orgId);
  const userRef = db.collection('users').doc(currentUser.uid);

  const orgSnap = await orgRef.get();
  const orgData = orgSnap.data();
  if (orgData.balance < montant) return alert("Fonds insuffisants dans l'organisation !");

  await orgRef.update({
    balance: firebase.firestore.FieldValue.increment(-montant)
  });

  await userRef.update({
    balance: firebase.firestore.FieldValue.increment(montant)
  });

  showNotification(`Vous avez récupéré ${montant.toFixed(2)}µ de l'organisation ${orgData.name}`);
  updateBalanceUI();
  loadOrganisations();
}

function listenToOnlineUsers() {
  db.collection("users").where("online", "==", true).onSnapshot(snapshot => {
    onlineList.innerHTML = "<strong>Connectés :</strong><br>";
    snapshot.forEach(doc => {
      const data = doc.data();
      onlineList.innerHTML += `${data.pseudo}<br>`;
    });
  });
}

function listenToNotifications() {
  db.collection("notifications").where("to", "==", currentUser.displayName)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          showNotification(data.message);
          db.collection("notifications").doc(change.doc.id).delete();
        }
      });
    });
}
