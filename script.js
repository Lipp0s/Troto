// Troto Social Media - Vanilla JS SPA

// --- Utility ---
function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'ora';
    if (diff < 3600) return `${Math.floor(diff/60)} min fa`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h fa`;
    return `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
}

function randomAvatarLetter(username) {
    return username ? username[0].toUpperCase() : '?';
}

// --- LocalStorage helpers ---
function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function loadData(key, fallback) {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
}

// --- CONFIG ---
const API_URL = 'http://localhost:4000/api';

// --- JWT Token ---
function saveToken(token) { localStorage.setItem('troto-token', token); }
function loadToken() { return localStorage.getItem('troto-token'); }
function clearToken() { localStorage.removeItem('troto-token'); }

// --- API helpers ---
async function api(endpoint, opts = {}) {
    const token = loadToken();
    opts.headers = opts.headers || {};
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && typeof opts.body !== 'string') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API_URL + endpoint, opts);
    if (!res.ok) throw await res.json();
    return await res.json();
}

// --- State ---
let currentUser = null;
let currentProfile = null;
let posts = [];

// --- DOM refs ---
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const navFeed = document.getElementById('nav-feed');
const navProfile = document.getElementById('nav-profile');
const feedView = document.getElementById('feed-view');
const profileView = document.getElementById('profile-view');
const newPostForm = document.getElementById('new-post-form');
const newPostText = document.getElementById('new-post-text');
const feedPosts = document.getElementById('feed-posts');
const profilePosts = document.getElementById('profile-posts');
const profileUsername = document.getElementById('profile-username');
const profileAvatar = document.getElementById('profile-avatar');
const profilePostCount = document.getElementById('profile-post-count');

// --- Public Profile ---
const publicProfileView = document.getElementById('public-profile-view');
const publicProfileAvatar = document.getElementById('public-profile-avatar');
const publicProfileUsername = document.getElementById('public-profile-username');
const publicProfilePostCount = document.getElementById('public-profile-post-count');
const publicProfileBioSection = document.getElementById('public-profile-bio-section');
const publicProfilePosts = document.getElementById('public-profile-posts');
const closePublicProfileBtn = document.getElementById('close-public-profile-btn');

// --- Profilo personalizzato ---
function getProfileData(username) {
    return loadData('troto-profile-' + username, {
        displayName: '',
        bio: '',
        avatar: '' // base64
    });
}
function saveProfileData(username, data) {
    saveData('troto-profile-' + username, data);
}

// --- UI refs per profilo ---
const editProfileBtn = document.getElementById('edit-profile-btn');
const profileEditSection = document.getElementById('profile-edit-section');
const profileEditForm = document.getElementById('profile-edit-form');
const profileAvatarInput = document.getElementById('profile-avatar-input');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');
const profileDisplayNameInput = document.getElementById('profile-displayname-input');
const profileBioInput = document.getElementById('profile-bio-input');
const cancelEditProfileBtn = document.getElementById('cancel-edit-profile-btn');

let profileEditAvatarData = '';

// --- AUTH UI ---
const showLoginTab = document.getElementById('show-login-tab');
const showRegisterTab = document.getElementById('show-register-tab');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const registerForm = document.getElementById('register-form');
const registerUsername = document.getElementById('register-username');
const registerPassword = document.getElementById('register-password');
const registerDisplayName = document.getElementById('register-displayname');
const registerBio = document.getElementById('register-bio');
const registerAvatar = document.getElementById('register-avatar');
const registerAvatarPreview = document.getElementById('register-avatar-preview');
const registerError = document.getElementById('register-error');

let registerAvatarData = '';

// --- App Logic ---
function renderApp() {
    if (!loadToken()) {
        authView.style.display = 'flex';
        mainView.style.display = 'none';
        loginUsername.value = '';
        loginUsername.focus();
        return;
    }
    authView.style.display = 'none';
    mainView.style.display = 'block';
    currentUserSpan.textContent = '@' + (currentUser || '');
    showFeed();
}

function showFeed() {
    feedView.style.display = 'block';
    profileView.style.display = 'none';
    navFeed.classList.add('active');
    navProfile.classList.remove('active');
    loadFeed();
}

function showProfile() {
    feedView.style.display = 'none';
    profileView.style.display = 'block';
    navFeed.classList.remove('active');
    navProfile.classList.add('active');
    renderProfile();
    loadMyPosts();
}

async function loadFeed() {
    try {
        const data = await api('/posts');
        posts = data;
        renderFeedPosts();
    } catch (err) {
        feedPosts.innerHTML = '<div style="color:#c00;text-align:center;">Errore nel caricamento del feed</div>';
    }
}

function renderFeedPosts() {
    feedPosts.innerHTML = '';
    if (!posts.length) {
        feedPosts.innerHTML = '<div style="text-align:center;color:#aaa;">Nessun post ancora. Scrivi il primo!</div>';
        return;
    }
    posts.forEach(post => {
        feedPosts.appendChild(createPostCard(post));
    });
}

async function loadMyPosts() {
    try {
        const data = await api('/users/' + encodeURIComponent(currentUser) + '/posts');
        renderProfilePosts(data);
    } catch (err) {
        profilePosts.innerHTML = '<div style="color:#c00;text-align:center;">Errore nel caricamento dei tuoi post</div>';
    }
}

function renderProfilePosts(userPosts) {
    profilePosts.innerHTML = '';
    if (!userPosts.length) {
        profilePosts.innerHTML = '<div style="text-align:center;color:#aaa;">Non hai ancora pubblicato nulla.</div>';
        return;
    }
    userPosts.forEach(post => {
        profilePosts.appendChild(createPostCard(post));
    });
    profilePostCount.textContent = `${userPosts.length} post`;
}

async function publishPost(text) {
    try {
        await api('/posts', { method: 'POST', body: { text } });
        await loadFeed();
        await loadMyPosts();
    } catch (err) {
        alert(err.error || 'Errore durante la pubblicazione');
    }
}

async function toggleLike(postId) {
    try {
        await api(`/posts/${postId}/like`, { method: 'POST' });
        await loadFeed();
        await loadMyPosts();
    } catch (err) {
        alert(err.error || 'Errore nel like');
    }
}

function renderProfile() {
    if (!currentProfile) return;
    profileUsername.textContent = currentProfile.displayName ? currentProfile.displayName : '@' + currentUser;
    profileAvatar.innerHTML = '';
    if (currentProfile.avatar) {
        const img = document.createElement('img');
        img.src = currentProfile.avatar;
        img.alt = 'avatar';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        profileAvatar.appendChild(img);
    } else {
        profileAvatar.textContent = randomAvatarLetter(currentUser);
    }
    // Mostra bio
    profileBioSection.textContent = currentProfile.bio || '';
    // Post count e lista post
    profilePostCount.textContent = '';
    profilePosts.innerHTML = '<div style="text-align:center;color:#aaa;">(I tuoi post saranno qui)</div>';
}

function createPostCard(post, isPublicProfile = false) {
    const card = document.createElement('div');
    card.className = 'post-card';
    // Header
    const header = document.createElement('div');
    header.className = 'post-header';
    const avatar = document.createElement('div');
    avatar.className = 'post-avatar';
    if (post.user.avatar) {
        const img = document.createElement('img');
        img.src = post.user.avatar;
        img.alt = 'avatar';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        avatar.appendChild(img);
    } else {
        avatar.textContent = randomAvatarLetter(post.user.username);
    }
    // Click su avatar/nome solo se non già in public profile
    if (!isPublicProfile) {
        avatar.style.cursor = 'pointer';
        avatar.onclick = () => showPublicProfile(post.user.username);
    }
    const username = document.createElement('span');
    username.className = 'post-username';
    username.textContent = post.user.displayName ? post.user.displayName : '@' + post.user.username;
    if (!isPublicProfile) {
        username.style.cursor = 'pointer';
        username.onclick = () => showPublicProfile(post.user.username);
    }
    const time = document.createElement('span');
    time.className = 'post-time';
    time.textContent = getTimeAgo(new Date(post.date));
    header.appendChild(avatar);
    header.appendChild(username);
    header.appendChild(time);
    // Text
    const text = document.createElement('div');
    text.className = 'post-text';
    text.textContent = post.text;
    // Actions
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn' + (post.liked ? ' liked' : '');
    likeBtn.innerHTML = `<i class=\"fas fa-heart\"></i> <span>${post.likeCount}</span>`;
    if (!isPublicProfile) {
        likeBtn.onclick = () => {
            toggleLike(post.id);
        };
    } else {
        likeBtn.disabled = true;
    }
    actions.appendChild(likeBtn);
    // Compose
    card.appendChild(header);
    card.appendChild(text);
    card.appendChild(actions);
    return card;
}

// --- Login/Registrazione ---
showLoginTab.onclick = () => {
    loginForm.style.display = '';
    registerForm.style.display = 'none';
    showLoginTab.classList.add('btn-primary');
    showLoginTab.classList.remove('btn-outline');
    showRegisterTab.classList.remove('btn-primary');
    showRegisterTab.classList.add('btn-outline');
    loginError.textContent = '';
    registerError.textContent = '';
};
showRegisterTab.onclick = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = '';
    showRegisterTab.classList.add('btn-primary');
    showRegisterTab.classList.remove('btn-outline');
    showLoginTab.classList.remove('btn-primary');
    showLoginTab.classList.add('btn-outline');
    loginError.textContent = '';
    registerError.textContent = '';
};

registerAvatar.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        registerAvatarData = ev.target.result;
        registerAvatarPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = registerAvatarData;
        img.alt = 'avatar';
        registerAvatarPreview.appendChild(img);
    };
    reader.readAsDataURL(file);
};

loginForm.onsubmit = async e => {
    e.preventDefault();
    loginError.textContent = '';
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    if (!username || !password) {
        loginError.textContent = 'Inserisci username e password';
        return;
    }
    try {
        const data = await api('/login', { method: 'POST', body: { username, password } });
        saveToken(data.token);
        currentUser = data.username;
        await loadMyProfile();
        renderApp();
    } catch (err) {
        loginError.textContent = err.error || 'Errore di rete';
    }
};

registerForm.onsubmit = async e => {
    e.preventDefault();
    registerError.textContent = '';
    document.getElementById('register-success').style.display = 'none';
    const username = registerUsername.value.trim();
    const password = registerPassword.value;
    const displayName = registerDisplayName.value.trim();
    const bio = registerBio.value.trim();
    const avatar = registerAvatarData;
    const email = prompt('Inserisci la tua email per la registrazione:');
    if (!username || !password || !email) {
        registerError.textContent = 'Username, email e password obbligatori';
        return;
    }
    try {
        await api('/register', { method: 'POST', body: { username, email, password, displayName, bio, avatar } });
        registerForm.style.display = 'none';
        const successDiv = document.getElementById('register-success');
        successDiv.textContent = "Registrazione riuscita! Controlla la tua email per verificare l'account.";
        successDiv.style.display = '';
    } catch (err) {
        registerError.textContent = err.error || 'Errore di rete';
    }
};

logoutBtn.onclick = () => {
    clearToken();
    currentUser = null;
    currentProfile = null;
    renderApp();
};

// --- Profilo ---
async function loadMyProfile() {
    try {
        const me = await api('/me');
        currentUser = me.username;
        currentProfile = me;
    } catch {
        currentProfile = null;
    }
}

function showEditProfile() {
    if (!currentProfile) return;
    profileEditSection.style.display = 'block';
    profileDisplayNameInput.value = currentProfile.displayName || '';
    profileBioInput.value = currentProfile.bio || '';
    profileAvatarPreview.innerHTML = '';
    profileEditAvatarData = currentProfile.avatar || '';
    if (currentProfile.avatar) {
        const img = document.createElement('img');
        img.src = currentProfile.avatar;
        img.alt = 'avatar';
        profileAvatarPreview.appendChild(img);
    }
}
function hideEditProfile() {
    profileEditSection.style.display = 'none';
}

editProfileBtn.onclick = () => {
    showEditProfile();
};
cancelEditProfileBtn.onclick = () => {
    hideEditProfile();
};

profileAvatarInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        profileEditAvatarData = ev.target.result;
        profileAvatarPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = profileEditAvatarData;
        img.alt = 'avatar';
        profileAvatarPreview.appendChild(img);
    };
    reader.readAsDataURL(file);
};

profileEditForm.onsubmit = async e => {
    e.preventDefault();
    const displayName = profileDisplayNameInput.value.trim();
    const bio = profileBioInput.value.trim();
    const avatar = profileEditAvatarData;
    try {
        const updated = await api('/me', { method: 'PUT', body: { displayName, bio, avatar } });
        currentProfile = updated;
        hideEditProfile();
        renderProfile();
    } catch (err) {
        alert(err.error || 'Errore di rete');
    }
};
navProfile.onclick = e => {
    e.preventDefault();
    showProfile();
};

newPostForm.onsubmit = async e => {
    e.preventDefault();
    const text = newPostText.value.trim();
    if (!text) return;
    await publishPost(text);
    newPostText.value = '';
};

// --- Public Profile ---
function showPublicProfile(username) {
    feedView.style.display = 'none';
    profileView.style.display = 'none';
    publicProfileView.style.display = 'block';
    loadPublicProfile(username);
}

async function loadPublicProfile(username) {
    publicProfileAvatar.innerHTML = '';
    publicProfileUsername.textContent = '';
    publicProfileBioSection.textContent = '';
    publicProfilePosts.innerHTML = '';
    publicProfilePostCount.textContent = '';
    try {
        const user = await api('/users/' + encodeURIComponent(username));
        publicProfileUsername.textContent = user.displayName ? user.displayName : '@' + user.username;
        if (user.avatar) {
            const img = document.createElement('img');
            img.src = user.avatar;
            img.alt = 'avatar';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            publicProfileAvatar.appendChild(img);
        } else {
            publicProfileAvatar.textContent = randomAvatarLetter(user.username);
        }
        publicProfileBioSection.textContent = user.bio || '';
        // Carica i post
        const posts = await api('/users/' + encodeURIComponent(username) + '/posts');
        renderPublicProfilePosts(posts);
    } catch (err) {
        publicProfilePosts.innerHTML = '<div style="color:#c00;text-align:center;">Errore nel caricamento del profilo</div>';
    }
}

function renderPublicProfilePosts(userPosts) {
    publicProfilePosts.innerHTML = '';
    if (!userPosts.length) {
        publicProfilePosts.innerHTML = '<div style="text-align:center;color:#aaa;">Nessun post ancora.</div>';
        publicProfilePostCount.textContent = '0 post';
        return;
    }
    userPosts.forEach(post => {
        publicProfilePosts.appendChild(createPostCard(post, true));
    });
    publicProfilePostCount.textContent = `${userPosts.length} post`;
}

closePublicProfileBtn.onclick = () => {
    publicProfileView.style.display = 'none';
    showFeed();
};

// --- Init ---
function init() {
    currentUser = localStorage.getItem('troto-user') || null;
    posts = loadData('troto-posts', []);
    renderApp();
}

init();

// Smooth scrolling per i link di navigazione
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = 'none';
    }
});

// Mobile menu toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
}

// Chiudi menu mobile quando si clicca su un link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// Animazioni al scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Osserva gli elementi per le animazioni
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.feature-card, .highlight, .user-post');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Counter animation per le statistiche hero
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    
    function updateCounter() {
        start += increment;
        if (start < target) {
            element.textContent = Math.floor(start) + '+';
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target + '+';
        }
    }
    
    updateCounter();
}

// Osserva le statistiche hero per l'animazione del counter
const heroStatsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumber = entry.target.querySelector('h3');
            const target = parseInt(statNumber.textContent);
            animateCounter(statNumber, target);
            heroStatsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stats .stat').forEach(stat => {
    heroStatsObserver.observe(stat);
});

// Hover effects per i feature cards
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
    });
});

// Smooth reveal per le sezioni
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('section').forEach(section => {
    section.classList.add('fade-in');
    revealObserver.observe(section);
});

// Phone mockup animations
function animatePhoneMockup() {
    const phoneMockup = document.querySelector('.phone-mockup');
    if (phoneMockup) {
        phoneMockup.style.opacity = '0';
        phoneMockup.style.transform = 'translateY(50px) scale(0.8)';
        
        setTimeout(() => {
            phoneMockup.style.transition = 'all 1s ease';
            phoneMockup.style.opacity = '1';
            phoneMockup.style.transform = 'translateY(0) scale(1)';
        }, 500);
    }
}

// Animate phones showcase
function animatePhonesShowcase() {
    const phones = document.querySelectorAll('.phone');
    phones.forEach((phone, index) => {
        phone.style.opacity = '0';
        phone.style.transform = 'translateY(50px) scale(0.8)';
        
        setTimeout(() => {
            phone.style.transition = 'all 0.8s ease';
            phone.style.opacity = '1';
            phone.style.transform = phone.className.includes('phone-1') ? 'rotate(-15deg)' :
                                   phone.className.includes('phone-2') ? 'translateX(-50%)' :
                                   'rotate(15deg)';
        }, index * 200);
    });
}

// Typing effect per il titolo hero
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.innerHTML = '';
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Inizializza typing effect quando la pagina è caricata
document.addEventListener('DOMContentLoaded', () => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const originalText = heroTitle.textContent;
        setTimeout(() => {
            typeWriter(heroTitle, originalText, 50);
        }, 500);
    }
    
    // Animate phone mockup after typing
    setTimeout(() => {
        animatePhoneMockup();
    }, 3000);
});

// Observe download section for phone showcase animation
const downloadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animatePhonesShowcase();
            downloadObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const downloadSection = document.querySelector('.download');
if (downloadSection) {
    downloadObserver.observe(downloadSection);
}

// Social media hover effects
document.querySelectorAll('.social-links a').forEach(link => {
    link.addEventListener('mouseenter', () => {
        link.style.transform = 'translateY(-3px) scale(1.1)';
    });
    
    link.addEventListener('mouseleave', () => {
        link.style.transform = 'translateY(0) scale(1)';
    });
});

// Download buttons hover effects
document.querySelectorAll('.download-buttons .btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-3px) scale(1.05)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0) scale(1)';
    });
});

// Gallery hover effects
document.querySelectorAll('.user-post').forEach(post => {
    post.addEventListener('mouseenter', () => {
        post.style.transform = 'scale(1.05)';
        post.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
    });
    
    post.addEventListener('mouseleave', () => {
        post.style.transform = 'scale(1)';
        post.style.boxShadow = 'none';
    });
});

// Parallax effect per gli elementi di sfondo
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.user-post, .feature-card');
    
    parallaxElements.forEach((element, index) => {
        const speed = 0.1 + (index * 0.02);
        element.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Aggiungi stili CSS per le animazioni
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.8s ease, transform 0.8s ease;
    }
    
    .fade-in.revealed {
        opacity: 1;
        transform: translateY(0);
    }
    
    .nav-menu.active {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        padding: 1rem;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    
    .nav-toggle.active span:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }
    
    .nav-toggle.active span:nth-child(2) {
        opacity: 0;
    }
    
    .nav-toggle.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -6px);
    }
    
    .phone-mockup {
        transition: all 1s ease;
    }
    
    .phone {
        transition: all 0.8s ease;
    }
    
    .user-post {
        transition: all 0.3s ease;
    }
    
    .feature-card {
        transition: all 0.3s ease;
    }
    
    .social-links a {
        transition: all 0.3s ease;
    }
    
    .download-buttons .btn {
        transition: all 0.3s ease;
    }
    
    @media (max-width: 768px) {
        .nav-menu {
            display: none;
        }
    }
    
    /* Pulse animation for download buttons */
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .download-buttons .btn-primary {
        animation: pulse 2s infinite;
    }
    
    /* Floating animation for phone mockup */
    @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
    }
    
    .phone-mockup {
        animation: float 6s ease-in-out infinite;
    }
    
    /* Gradient animation for hero background */
    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    
    .hero {
        background-size: 200% 200%;
        animation: gradientShift 15s ease infinite;
    }
`;

document.head.appendChild(style);

// Preloader
window.addEventListener('load', () => {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }
});

// Effetto particelle per il background hero
function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        pointer-events: none;
        animation: particleFloat 6s linear infinite;
    `;
    
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 6 + 's';
    
    document.querySelector('.hero').appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, 6000);
}

// Crea particelle periodicamente
setInterval(createParticle, 300);

// Aggiungi stili per le particelle
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes particleFloat {
        0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
        }
    }
`;

document.head.appendChild(particleStyle);

// Interactive elements for social network feel
document.addEventListener('DOMContentLoaded', () => {
    // Add like functionality to posts
    document.querySelectorAll('.post-actions span').forEach(action => {
        if (action.textContent.includes('❤️')) {
            action.addEventListener('click', () => {
                action.style.color = '#ff6b6b';
                action.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    action.style.transform = 'scale(1)';
                }, 200);
            });
        }
    });
    
    // Add share functionality
    document.querySelectorAll('.post-actions span').forEach(action => {
        if (action.textContent.includes('📤')) {
            action.addEventListener('click', () => {
                action.style.color = '#4ecdc4';
                action.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    action.style.transform = 'scale(1)';
                }, 200);
            });
        }
    });
});

function showEditProfile() {
    const profile = getProfileData(currentUser);
    profileEditSection.style.display = 'block';
    profileDisplayNameInput.value = profile.displayName || '';
    profileBioInput.value = profile.bio || '';
    profileAvatarPreview.innerHTML = '';
    profileEditAvatarData = profile.avatar || '';
    if (profile.avatar) {
        const img = document.createElement('img');
        img.src = profile.avatar;
        img.alt = 'avatar';
        profileAvatarPreview.appendChild(img);
    }
}
function hideEditProfile() {
    profileEditSection.style.display = 'none';
}

editProfileBtn.onclick = () => {
    showEditProfile();
};
cancelEditProfileBtn.onclick = () => {
    hideEditProfile();
};

profileAvatarInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        profileEditAvatarData = ev.target.result;
        profileAvatarPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = profileEditAvatarData;
        img.alt = 'avatar';
        profileAvatarPreview.appendChild(img);
    };
    reader.readAsDataURL(file);
};

profileEditForm.onsubmit = e => {
    e.preventDefault();
    const displayName = profileDisplayNameInput.value.trim();
    const bio = profileBioInput.value.trim();
    const avatar = profileEditAvatarData;
    saveProfileData(currentUser, { displayName, bio, avatar });
    hideEditProfile();
    renderProfile();
}; 