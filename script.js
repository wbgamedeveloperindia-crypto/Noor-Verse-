/* ==========================================================================
   NOOR VERSE - ADVANCED CORE LOGIC & API INTEGRATION (app.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // پوری ویب سائٹ کا بنیادی کنٹرولر
    AppController.init();
});

/* --------------------------------------------------------------------------
   GLOBAL STATE MANAGEMENT
   -------------------------------------------------------------------------- */
const AppState = {
    allSurahs: [],
    currentSurah: null,
    currentSurahAudio: [],
    audioPlayer: null,
    currentAudioIndex: 0,
    isPlaying: false,
    userLocation: { lat: null, lon: null, city: null },
    qiblaDegree: null,
    deferredPrompt: null
};

/* --------------------------------------------------------------------------
   API CONFIGURATION & ENDPOINTS
   -------------------------------------------------------------------------- */
const API = {
    quranBase: 'https://api.alquran.cloud/v1',
    aladhanBase: 'https://api.aladhan.com/v1',
    endpoints: {
        surahList: '/surah',
        uthmaniText: (surah) => `/surah/${surah}/quran-uthmani`,
        audioAlafasy: (surah) => `/surah/${surah}/ar.alafasy`,
        translation: (surah, lang) => `/surah/${surah}/${lang}`,
        search: (keyword) => `/search/${keyword}/all/quran-uthmani`,
        prayerCoords: (lat, lon, timestamp) => `/timings/${timestamp}?latitude=${lat}&longitude=${lon}&method=1`,
        prayerCity: (city) => `/timingsByCity?city=${city}&country=India&method=1`,
        qibla: (lat, lon) => `/qibla/${lat}/${lon}`
    }
};

/* --------------------------------------------------------------------------
   MAIN APPLICATION CONTROLLER
   -------------------------------------------------------------------------- */
const AppController = {
    init() {
        console.log("Noor Verse Initialized...");
        this.cacheDOM();
        this.bindEvents();
        this.setupAudioPlayer();
        this.initPWA();
        
        // ابتدائی ڈیٹا لوڈ کریں
        QuranService.fetchSurahList();
    },

    cacheDOM() {
        // Navigation
        this.views = document.querySelectorAll('.view-section');
        
        // PWA
        this.installBtn = document.getElementById('btn-install-app');
        
        // Quran Elements
        this.surahContainer = document.getElementById('surah-list-container');
        this.searchInput = document.getElementById('search-surah');
        this.arabicContainer = document.getElementById('arabic-text-container');
        this.transContainer = document.getElementById('translation-display-container');
        this.surahTitle = document.getElementById('current-surah-title');
        
        // Modals & Controls
        this.modalTilawat = document.getElementById('modal-tilawat');
        this.modalTarjuma = document.getElementById('modal-tarjuma');
        this.btnOpenTilawat = document.getElementById('btn-open-tilawat');
        this.btnOpenTarjuma = document.getElementById('btn-open-tarjuma');
        this.closeButtons = document.querySelectorAll('.btn-close-modal');
        
        // Audio Controls
        this.btnPlayFull = document.getElementById('btn-play-full');
        this.btnPlayRange = document.getElementById('btn-play-range');
        this.btnStopAudio = document.getElementById('btn-stop-audio');
        this.audioStartInput = document.getElementById('audio-start-ayah');
        this.audioEndInput = document.getElementById('audio-end-ayah');
        
        // Translation Controls
        this.btnFetchTrans = document.getElementById('btn-fetch-translation');
        this.transLangSelect = document.getElementById('translation-language');
        this.transStartInput = document.getElementById('trans-start-ayah');
        this.transEndInput = document.getElementById('trans-end-ayah');
        
        // Location & Prayer Elements
        this.locText = document.getElementById('current-location-text');
        this.cityInput = document.getElementById('manual-city-input');
        this.btnSearchCity = document.getElementById('btn-search-city');
        this.qiblaStatus = document.getElementById('qibla-status-text');
    },

    bindEvents() {
        // Search Logic
        if(this.searchInput) {
            this.searchInput.addEventListener('input', UIHandler.debounce((e) => {
                QuranService.handleSearch(e.target.value);
            }, 400));
        }

        // Modals Logic
        if(this.btnOpenTilawat) this.btnOpenTilawat.addEventListener('click', () => UIHandler.showModal(this.modalTilawat));
        if(this.btnOpenTarjuma) this.btnOpenTarjuma.addEventListener('click', () => UIHandler.showModal(this.modalTarjuma));
        
        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.control-modal');
                if(modal) UIHandler.hideModal(modal);
            });
        });

        // Audio Triggers
        if(this.btnPlayFull) this.btnPlayFull.addEventListener('click', () => AudioController.playFull());
        if(this.btnPlayRange) this.btnPlayRange.addEventListener('click', () => AudioController.playRange());
        if(this.btnStopAudio) this.btnStopAudio.addEventListener('click', () => AudioController.stop());

        // Translation Trigger
        if(this.btnFetchTrans) this.btnFetchTrans.addEventListener('click', () => TranslationService.fetchAndDisplay());

        // Prayer City Search
        if(this.btnSearchCity) {
            this.btnSearchCity.addEventListener('click', () => {
                const city = this.cityInput.value.trim();
                if(city) PrayerService.fetchByCity(city);
            });
        }
    },

    setupAudioPlayer() {
        // Create an audio element if it doesn't exist in HTML
        let player = document.getElementById('quran-audio-player');
        if (!player) {
            player = document.createElement('audio');
            player.id = 'quran-audio-player';
            document.body.appendChild(player);
        }
        AppState.audioPlayer = player;
    },

    initPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            AppState.deferredPrompt = e;
            if (this.installBtn) {
                this.installBtn.classList.remove('hidden');
                this.installBtn.addEventListener('click', async () => {
                    this.installBtn.classList.add('hidden');
                    AppState.deferredPrompt.prompt();
                    const { outcome } = await AppState.deferredPrompt.userChoice;
                    console.log(`PWA Install outcome: ${outcome}`);
                    AppState.deferredPrompt = null;
                });
            }
        });
    },

    navigateTo(viewId) {
        this.views.forEach(section => {
            section.classList.remove('active-view');
            section.classList.add('hidden');
        });
        
        const target = document.getElementById(viewId);
        if(target) {
            target.classList.remove('hidden');
            target.classList.add('active-view');
        }

        if (viewId !== 'view-quran-reader') {
            AudioController.stop();
        }

        if (viewId === 'view-qibla') QiblaService.init();
        if (viewId === 'view-prayer') PrayerService.init();
    }
};

/* --------------------------------------------------------------------------
   QURAN SERVICE (Surah List & Text)
   -------------------------------------------------------------------------- */
const QuranService = {
    async fetchSurahList() {
        UIHandler.showLoading(AppController.surahContainer, "قرآن پاک لوڈ ہو رہا ہے...");
        try {
            const res = await fetch(API.quranBase + API.endpoints.surahList);
            const data = await res.json();
            if (data.code === 200) {
                AppState.allSurahs = data.data;
                UIHandler.renderSurahList(AppState.allSurahs);
            }
        } catch (error) {
            console.error("Surah List Error:", error);
            AppController.surahContainer.innerHTML = '<p class="error-msg">انٹرنیٹ کنکشن چیک کریں۔ سورتیں لوڈ نہیں ہو سکیں۔</p>';
        }
    },

    async handleSearch(query) {
        query = query.toLowerCase().trim();
        if (!query) {
            UIHandler.renderSurahList(AppState.allSurahs);
            return;
        }

        const isArabic = /[\u0600-\u06FF]/.test(query);

        if (isArabic && query.length > 2) {
            try {
                const res = await fetch(API.quranBase + API.endpoints.search(query));
                const data = await res.json();
                if (data.code === 200 && data.data.matches.length > 0) {
                    const matchedNumbers = [...new Set(data.data.matches.map(m => m.surah.number))];
                    const filtered = AppState.allSurahs.filter(s => matchedNumbers.includes(s.number));
                    UIHandler.renderSurahList(filtered);
                } else {
                    AppController.surahContainer.innerHTML = '<p>کوئی نتیجہ نہیں ملا۔</p>';
                }
            } catch (err) {
                console.error("Search Error:", err);
            }
        } else {
            const filtered = AppState.allSurahs.filter(s => 
                s.englishName.toLowerCase().includes(query) || 
                s.number.toString() === query ||
                s.englishNameTranslation.toLowerCase().includes(query)
            );
            UIHandler.renderSurahList(filtered);
        }
    },

    async openSurah(surahNumber, surahName, totalAyahs) {
        AppController.navigateTo('view-quran-reader');
        AppController.surahTitle.innerText = surahName;
        UIHandler.showLoading(AppController.arabicContainer, "مصحف لوڈ ہو رہا ہے...");
        AppController.transContainer.classList.add('hidden');
        AppController.transContainer.innerHTML = '';

        AppState.currentSurah = { number: surahNumber, total: totalAyahs };
        UIHandler.setupModalLimits(totalAyahs);

        try {
            const [textRes, audioRes] = await Promise.all([
                fetch(API.quranBase + API.endpoints.uthmaniText(surahNumber)),
                fetch(API.quranBase + API.endpoints.audioAlafasy(surahNumber))
            ]);

            const textData = await textRes.json();
            const audioData = await audioRes.json();

            // Extract Audio URLs
            AppState.currentSurahAudio = audioData.data.ayahs.map(a => a.audio);

            // Format Arabic Text
            let htmlContent = '<div class="mushaf-layout">';
            textData.data.ayahs.forEach(ayah => {
                let text = ayah.text;
                // Remove Bismillah from first ayah unless it's Fatihah or Tawbah
                if (ayah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
                    text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
                }
                htmlContent += `<span class="ayah-text">${text}</span> <span class="ayah-end">﴿${ayah.numberInSurah}﴾</span> `;
            });
            htmlContent += '</div>';
            
            AppController.arabicContainer.innerHTML = htmlContent;

        } catch (error) {
            console.error("Mushaf Error:", error);
            AppController.arabicContainer.innerHTML = '<p class="error-msg">مصحف لوڈ کرنے میں مسئلہ پیش آیا۔</p>';
        }
    }
};

/* --------------------------------------------------------------------------
   AUDIO CONTROLLER (Alafasy Recitation)
   -------------------------------------------------------------------------- */
const AudioController = {
    playFull() {
        if (!AppState.currentSurah) return;
        this.startPlayback(1, AppState.currentSurah.total);
    },

    playRange() {
        if (!AppState.currentSurah) return;
        let start = parseInt(AppController.audioStartInput.value) || 1;
        let end = parseInt(AppController.audioEndInput.value) || AppState.currentSurah.total;
        
        if (start < 1) start = 1;
        if (end > AppState.currentSurah.total) end = AppState.currentSurah.total;
        if (start > end) {
            alert("شروع کی آیت اختتامی آیت سے بڑی نہیں ہو سکتی!");
            return;
        }

        this.startPlayback(start, end);
    },

    startPlayback(startAyah, endAyah) {
        if (AppState.currentSurahAudio.length === 0) return;
        
        UIHandler.hideModal(AppController.modalTilawat);
        
        AppState.currentAudioIndex = startAyah - 1; 
        const finalIndex = endAyah - 1;
        AppState.isPlaying = true;

        const player = AppState.audioPlayer;
        
        player.onended = () => {
            if (AppState.currentAudioIndex < finalIndex) {
                AppState.currentAudioIndex++;
                this.playCurrent();
            } else {
                this.stop();
            }
        };

        this.playCurrent();
    },

    playCurrent() {
        const player = AppState.audioPlayer;
        player.src = AppState.currentSurahAudio[AppState.currentAudioIndex];
        player.play().catch(e => console.error("Audio block by browser:", e));
        
        // Highlight active Ayah visually if needed
        console.log(`Playing Ayah: ${AppState.currentAudioIndex + 1}`);
    },

    stop() {
        const player = AppState.audioPlayer;
        if(player) {
            player.pause();
            player.currentTime = 0;
            player.onended = null;
        }
        AppState.isPlaying = false;
    }
};

/* --------------------------------------------------------------------------
   TRANSLATION SERVICE
   -------------------------------------------------------------------------- */
const TranslationService = {
    async fetchAndDisplay() {
        if (!AppState.currentSurah) return;

        let start = parseInt(AppController.transStartInput.value) || 1;
        let end = parseInt(AppController.transEndInput.value) || AppState.currentSurah.total;
        let langCode = AppController.transLangSelect.value || 'ur.jalandhry'; // Default Urdu

        if (start < 1) start = 1;
        if (end > AppState.currentSurah.total) end = AppState.currentSurah.total;
        if (start > end) {
            alert("شروع کی آیت اختتامی آیت سے بڑی نہیں ہو سکتی!");
            return;
        }

        UIHandler.hideModal(AppController.modalTarjuma);
        const container = AppController.transContainer;
        container.classList.remove('hidden');
        UIHandler.showLoading(container, "ترجمہ لوڈ ہو رہا ہے...");

        try {
            // Fetch Translation & Original Arabic concurrently for display
            const [transRes, arRes] = await Promise.all([
                fetch(API.quranBase + API.endpoints.translation(AppState.currentSurah.number, langCode)),
                fetch(API.quranBase + API.endpoints.uthmaniText(AppState.currentSurah.number))
            ]);

            const transData = await transRes.json();
            const arData = await arRes.json();

            let html = '<div class="translation-wrapper">';
            const isRtl = (langCode === 'ur.jalandhry' || langCode === 'ar');

            for (let i = start - 1; i <= end - 1; i++) {
                html += `
                    <div class="translation-card">
                        <div class="arabic-snippet" dir="rtl">${arData.data.ayahs[i].text} ﴿${i + 1}﴾</div>
                        <div class="trans-text" dir="${isRtl ? 'rtl' : 'ltr'}">${transData.data.ayahs[i].text}</div>
                    </div>
                `;
            }
            html += '</div>';
            
            container.innerHTML = html;
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            console.error("Translation Error:", err);
            container.innerHTML = '<p class="error-msg">ترجمہ لوڈ کرنے میں ناکامی۔</p>';
        }
    }
};

/* --------------------------------------------------------------------------
   PRAYER TIMES SERVICE (Aladhan API)
   -------------------------------------------------------------------------- */
const PrayerService = {
    init() {
        if (AppState.userLocation.lat && AppState.userLocation.lon) {
            this.fetchByCoords(AppState.userLocation.lat, AppState.userLocation.lon);
        } else {
            this.detectLocation();
        }
    },

    detectLocation() {
        if (AppController.locText) {
            AppController.locText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> لوکیشن تلاش کی جا رہی ہے...';
        }
        
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    AppState.userLocation.lat = pos.coords.latitude;
                    AppState.userLocation.lon = pos.coords.longitude;
                    if(AppController.locText) AppController.locText.innerHTML = '<i class="fas fa-map-marker-alt"></i> آپ کی لوکیشن (GPS)';
                    this.fetchByCoords(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    console.warn("GPS Denied, Fallback to Delhi/Kolkata");
                    // Fallback Location (India default)
                    AppState.userLocation.lat = 22.5726; 
                    AppState.userLocation.lon = 88.3639; // Kolkata
                    if(AppController.locText) AppController.locText.innerHTML = '<i class="fas fa-map-marker-alt"></i> ڈیفالٹ: کولکتہ (GPS بند ہے)';
                    this.fetchByCoords(AppState.userLocation.lat, AppState.userLocation.lon);
                }
            );
        }
    },

    async fetchByCoords(lat, lon) {
        const timestamp = Math.floor(Date.now() / 1000);
        try {
            const res = await fetch(API.aladhanBase + API.endpoints.prayerCoords(lat, lon, timestamp));
            const data = await res.json();
            if(data.code === 200) UIHandler.updatePrayerUI(data.data);
        } catch (e) { console.error("Prayer API Error:", e); }
    },

    async fetchByCity(city) {
        if(AppController.locText) AppController.locText.innerHTML = `<i class="fas fa-search"></i> شہر: ${city}`;
        try {
            const res = await fetch(API.aladhanBase + API.endpoints.prayerCity(city));
            const data = await res.json();
            if(data.code === 200) UIHandler.updatePrayerUI(data.data);
            else alert("شہر کا نام درست نہیں ہے۔");
        } catch (e) { console.error("City Search Error:", e); }
    },

    // Fix for Aladhan Timezone string e.g., "05:30 (+0530)"
    cleanTime(timeStr) {
        return timeStr.split(' ')[0]; // Returns only "05:30"
    }
};

/* --------------------------------------------------------------------------
   QIBLA COMPASS SERVICE
   -------------------------------------------------------------------------- */
const QiblaService = {
    async init() {
        if (!AppState.userLocation.lat || !AppState.userLocation.lon) {
            if(AppController.qiblaStatus) AppController.qiblaStatus.innerText = "GPS لوکیشن درکار ہے...";
            this.requestLocationForQibla();
        } else {
            await this.fetchDegree();
            this.startSensors();
        }
    },

    requestLocationForQibla() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                AppState.userLocation.lat = pos.coords.latitude;
                AppState.userLocation.lon = pos.coords.longitude;
                await this.fetchDegree();
                this.startSensors();
            }, () => {
                if(AppController.qiblaStatus) AppController.qiblaStatus.innerText = "براہ کرم ڈیوائس کی لوکیشن آن کریں۔";
            });
        }
    },

    async fetchDegree() {
        if (AppState.qiblaDegree) return; // cache
        try {
            const res = await fetch(API.aladhanBase + API.endpoints.qibla(AppState.userLocation.lat, AppState.userLocation.lon));
            const data = await res.json();
            if (data.code === 200) {
                AppState.qiblaDegree = data.data.direction;
                const degreeEl = document.getElementById('qibla-degree');
                if(degreeEl) degreeEl.innerText = `${Math.round(AppState.qiblaDegree)}°`;
                if(AppController.qiblaStatus) AppController.qiblaStatus.innerText = "فون کو زمین کے متوازی (سیدھا) رکھیں۔";
            }
        } catch (e) { console.error("Qibla fetch error:", e); }
    },

    startSensors() {
        if (!window.DeviceOrientationEvent) {
            if(AppController.qiblaStatus) AppController.qiblaStatus.innerText = "آپ کا فون کمپاس کو سپورٹ نہیں کرتا۔";
            return;
        }

        // Handle iOS 13+ permissions
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            AppController.qiblaStatus.innerHTML = `<button id="btn-compass-perm" class="btn-primary">کمپاس کی اجازت دیں (Enable Compass)</button>`;
            document.getElementById('btn-compass-perm').addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission().then(res => {
                    if (res === 'granted') {
                        window.addEventListener('deviceorientation', this.handleOrientation.bind(this), true);
                        AppController.qiblaStatus.innerText = "فون کو دائیں بائیں گھمائیں۔";
                    }
                }).catch(e => console.error(e));
            });
        } else {
            window.addEventListener('deviceorientationabsolute', this.handleOrientation.bind(this), true);
            window.addEventListener('deviceorientation', this.handleOrientation.bind(this), true);
        }
    },

    handleOrientation(event) {
        if (AppState.qiblaDegree === null) return;

        let compassHeading = event.webkitCompassHeading; // for iOS
        if (!compassHeading && event.absolute) {
            compassHeading = 360 - event.alpha; // Android
        } else if (!compassHeading) {
            compassHeading = 360 - event.alpha; // Fallback
        }

        if (compassHeading) {
            const dial = document.getElementById('compass-dial');
            const needle = document.getElementById('qibla-needle');
            
            if(dial) dial.style.transform = `rotate(${-compassHeading}deg)`;
            
            // Calculate relative needle position
            let needleRot = AppState.qiblaDegree - compassHeading;
            if(needle) needle.style.transform = `translate(-50%, -50%) rotate(${needleRot}deg)`;
        }
    }
};

/* --------------------------------------------------------------------------
   UI HANDLER & HELPERS
   -------------------------------------------------------------------------- */
const UIHandler = {
    renderSurahList(surahs) {
        if(!AppController.surahContainer) return;
        AppController.surahContainer.innerHTML = ''; 

        surahs.forEach(surah => {
            const item = document.createElement('div');
            item.className = 'surah-item';
            // Expose a global wrapper for inline HTML onclick if needed, 
            // but adding listener directly is safer
            item.addEventListener('click', () => {
                QuranService.openSurah(surah.number, surah.englishName, surah.numberOfAyahs);
            });
            
            item.innerHTML = `
                <div class="surah-number">${surah.number}</div>
                <div class="surah-details">
                    <h4>${surah.englishName}</h4>
                    <p>${surah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'} • ${surah.numberOfAyahs} آیات</p>
                </div>
                <div class="surah-arabic">${surah.name}</div>
            `;
            AppController.surahContainer.appendChild(item);
        });
    },

    updatePrayerUI(data) {
        const timings = data.timings;
        const hijriEl = document.getElementById('islamic-date');
        if(hijriEl) hijriEl.innerText = data.date.hijri.date;

        // Clean time strings using our helper
        const tFajr = PrayerService.cleanTime(timings.Fajr);
        const tSunrise = PrayerService.cleanTime(timings.Sunrise);
        const tDhuhr = PrayerService.cleanTime(timings.Dhuhr);
        const tAsr = PrayerService.cleanTime(timings.Asr);
        const tMaghrib = PrayerService.cleanTime(timings.Maghrib);
        const tIsha = PrayerService.cleanTime(timings.Isha);

        // Update DOM safely
        const setTime = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        setTime('time-fajr', tFajr);
        setTime('time-sunrise', tSunrise);
        setTime('time-dhuhr', tDhuhr);
        setTime('time-asr', tAsr);
        setTime('time-maghrib', tMaghrib);
        setTime('time-isha', tIsha);

        this.highlightNextPrayer([tFajr, tSunrise, tDhuhr, tAsr, tMaghrib, tIsha]);
    },

    highlightNextPrayer(cleanTimingsArray) {
        const rows = document.querySelectorAll('.prayer-row');
        rows.forEach(r => r.classList.remove('active'));
        
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        const parseMins = (str) => {
            const p = str.split(':');
            return parseInt(p[0]) * 60 + parseInt(p[1]);
        };

        const ids = ['row-fajr', 'row-sunrise', 'row-dhuhr', 'row-asr', 'row-maghrib', 'row-isha'];
        let nextId = 'row-fajr';

        for (let i = 0; i < cleanTimingsArray.length; i++) {
            if (currentMins < parseMins(cleanTimingsArray[i])) {
                nextId = ids[i];
                break;
            }
        }
        
        const activeRow = document.getElementById(nextId);
        if(activeRow) activeRow.classList.add('active');
    },

    setupModalLimits(max) {
        const inputs = [
            AppController.audioStartInput, 
            AppController.audioEndInput, 
            AppController.transStartInput, 
            AppController.transEndInput
        ];
        
        inputs.forEach(el => {
            if(el) {
                el.min = 1;
                el.max = max;
                el.value = '';
            }
        });
        
        if(AppController.audioEndInput) AppController.audioEndInput.placeholder = `اختتام (Max ${max})`;
        if(AppController.transEndInput) AppController.transEndInput.placeholder = `اختتام (Max ${max})`;
    },

    showModal(modalEl) { if(modalEl) modalEl.classList.remove('hidden'); },
    hideModal(modalEl) { if(modalEl) modalEl.classList.add('hidden'); },
    
    showLoading(container, message) {
        if(container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-circle-notch fa-spin fa-3x" style="color: #10b981;"></i>
                    <p style="margin-top: 15px; font-weight: bold; color: #333;">${message}</p>
                </div>
            `;
        }
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Expose navigateTo globally so your HTML onclick="navigateTo('view-id')" still works
window.navigateTo = function(viewId) {
    AppController.navigateTo(viewId);
};