/* ==========================================================================
   NOORVERSE PRODUCTION CORE ENGINE v2.0
   FULLY REBUILT - STABLE - SAFE - PROFESSIONAL
   ========================================================================== */

/* ==========================================================================
   GLOBAL STATE
   ========================================================================== */

const AppState = {

    surahs: [],
    currentSurah: null,
    audioList: [],
    audioIndex: 0,
    audioEndIndex: 0,

    audioPlayer: null,

    userLat: null,
    userLon: null,

    qiblaDegree: null,

    domReady: false,
    apiReady: false,

};


/* ==========================================================================
   SAFE DOM HELPERS
   ========================================================================== */

function $(id)
{
    return document.getElementById(id);
}

function safeSetHTML(id, html)
{
    const el = $(id);
    if (el) el.innerHTML = html;
}

function safeSetText(id, text)
{
    const el = $(id);
    if (el) el.innerText = text;
}

function show(id)
{
    const el = $(id);
    if (el) el.classList.remove("hidden");
}

function hide(id)
{
    const el = $(id);
    if (el) el.classList.add("hidden");
}


/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

window.addEventListener("DOMContentLoaded", initApp);

async function initApp()
{
    console.log("NoorVerse Initializing...");

    AppState.audioPlayer = $("quran-audio-player");

    bindUI();

    await loadSurahList();

    AppState.domReady = true;

    console.log("NoorVerse Ready.");
}


/* ==========================================================================
   UI BINDINGS
   ========================================================================== */

function bindUI()
{
    bindSearch();
    bindAudioControls();
    bindTranslationControls();
    bindPrayerControls();
}


/* ==========================================================================
   SURAH LIST LOADING
   ========================================================================== */

async function loadSurahList()
{
    safeSetHTML("surah-list-container",
        "<p style='text-align:center;padding:20px'>Loading Quran...</p>");

    try
    {
        const res =
        await fetch(
        "https://api.alquran.cloud/v1/surah");

        const json =
        await res.json();

        AppState.surahs =
        json.data;

        renderSurahList(AppState.surahs);
    }
    catch(e)
    {
        console.error(e);

        safeSetHTML(
        "surah-list-container",
        "Failed to load Quran.");
    }
}


function renderSurahList(list)
{
    const container =
    $("surah-list-container");

    container.innerHTML = "";

    list.forEach(surah =>
    {

        const div =
        document.createElement("div");

        div.className =
        "surah-item";

        div.innerHTML =
        `
        <div class="surah-number">${surah.number}</div>

        <div class="surah-details">

        <h4>${surah.englishName}</h4>

        <p>${surah.revelationType}
        •
        ${surah.numberOfAyahs} Ayahs</p>

        </div>

        <div class="surah-arabic">
        ${surah.name}
        </div>
        `;

        div.onclick =
        () =>
        openSurah(
        surah.number,
        surah.englishName,
        surah.numberOfAyahs);

        container.appendChild(div);

    });
}


/* ==========================================================================
   SEARCH SYSTEM
   ========================================================================== */

function bindSearch()
{
    const input =
    $("search-surah");

    if(!input) return;

    input.addEventListener(
    "input",
    e =>
    {

        const query =
        e.target.value
        .toLowerCase()
        .trim();

        if(!query)
        {
            renderSurahList(
            AppState.surahs);

            return;
        }

        const filtered =
        AppState.surahs.filter(
        s =>
        s.englishName
        .toLowerCase()
        .includes(query)
        ||
        s.number
        .toString()
        === query
        );

        renderSurahList(filtered);

    });
}


/* ==========================================================================
   OPEN SURAH
   ========================================================================== */

async function openSurah(number,name,total)
{
    navigateTo("view-quran-reader");

    AppState.currentSurah =
    number;

    safeSetText(
    "current-surah-title",
    name);

    safeSetHTML(
    "arabic-text-container",
    "Loading Mushaf...");

    await loadArabic(number);

    await loadAudio(number);
}


/* ==========================================================================
   LOAD ARABIC TEXT
   ========================================================================== */

async function loadArabic(number)
{
    try
    {
        const res =
        await fetch(
        `https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);

        const json =
        await res.json();

        const ayahs =
        json.data.ayahs;

        let html = "";

        ayahs.forEach(a =>
        {

            html +=
            `${a.text}
            <span class="ayah-end">
            ${a.numberInSurah}
            </span> `;

        });

        safeSetHTML(
        "arabic-text-container",
        html);

    }
    catch(e)
    {
        safeSetHTML(
        "arabic-text-container",
        "Failed loading surah.");
    }
}


/* ==========================================================================
   LOAD AUDIO
   ========================================================================== */

async function loadAudio(number)
{
    try
    {
        const res =
        await fetch(
        `https://api.alquran.cloud/v1/surah/${number}/ar.alafasy`);

        const json =
        await res.json();

        AppState.audioList =
        json.data.ayahs
        .map(a => a.audio);

    }
    catch(e)
    {
        console.error(e);
    }
}


/* ==========================================================================
   AUDIO CONTROLS
   ========================================================================== */

function bindAudioControls()
{

    $("btn-play-full")
    ?.addEventListener(
    "click",
    () =>
    startAudio(
    0,
    AppState.audioList.length-1));

    $("btn-play-range")
    ?.addEventListener(
    "click",
    () =>
    {

        let start =
        parseInt(
        $("audio-start-ayah").value)-1;

        let end =
        parseInt(
        $("audio-end-ayah").value)-1;

        if(isNaN(start)) start=0;

        if(isNaN(end))
        end=
        AppState.audioList.length-1;

        startAudio(start,end);

    });

    $("btn-stop-audio")
    ?.addEventListener(
    "click",
    stopAudio);

}


function startAudio(start,end)
{
    AppState.audioIndex =
    start;

    AppState.audioEndIndex =
    end;

    playNextAudio();
}


function playNextAudio()
{
    if(AppState.audioIndex >
       AppState.audioEndIndex)
    return;

    const url =
    AppState.audioList
    [AppState.audioIndex];

    AppState.audioPlayer.src =
    url;

    AppState.audioPlayer.play();

    AppState.audioPlayer.onended =
    () =>
    {
        AppState.audioIndex++;
        playNextAudio();
    };
}


function stopAudio()
{
    AppState.audioPlayer.pause();
}


/* ==========================================================================
   TRANSLATION
   ========================================================================== */

function bindTranslationControls()
{

    $("btn-fetch-translation")
    ?.addEventListener(
    "click",
    fetchTranslation);

}


async function fetchTranslation()
{
    const lang =
    $("translation-language").value;

    const surah =
    AppState.currentSurah;

    safeSetHTML(
    "translation-display-container",
    "Loading translation...");

    show("translation-display-container");

    try
    {
        const res =
        await fetch(
        `https://api.alquran.cloud/v1/surah/${surah}/${lang}`);

        const json =
        await res.json();

        const ayahs =
        json.data.ayahs;

        let html="";

        ayahs.forEach(a =>
        {

            html+=
            `<div class="translation-block">

            <div>${a.numberInSurah}</div>

            <div>${a.text}</div>

            </div>`;

        });

        safeSetHTML(
        "translation-display-container",
        html);

    }
    catch(e)
    {
        safeSetHTML(
        "translation-display-container",
        "Translation failed.");
    }
}


/* ==========================================================================
   PRAYER TIMES
   ========================================================================== */

function bindPrayerControls()
{

    $("btn-search-city")
    ?.addEventListener(
    "click",
    searchCityPrayer);

}


async function searchCityPrayer()
{
    const city =
    $("manual-city-input")
    .value;

    if(!city) return;

    const res =
    await fetch(
    `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=India&method=1`);

    const json =
    await res.json();

    updatePrayerUI(
    json.data);
}


function updatePrayerUI(data)
{
    const t =
    data.timings;

    safeSetText("time-fajr",t.Fajr);
    safeSetText("time-dhuhr",t.Dhuhr);
    safeSetText("time-asr",t.Asr);
    safeSetText("time-maghrib",t.Maghrib);
    safeSetText("time-isha",t.Isha);

    safeSetText(
    "islamic-date",
    data.date.hijri.date);
}


/* ==========================================================================
   QIBLA
   ========================================================================== */

async function initQibla()
{
    navigator.geolocation.getCurrentPosition(
    async pos =>
    {

        const lat =
        pos.coords.latitude;

        const lon =
        pos.coords.longitude;

        const res =
        await fetch(
        `https://api.aladhan.com/v1/qibla/${lat}/${lon}`);

        const json =
        await res.json();

        const deg =
        json.data.direction;

        safeSetText(
        "qibla-degree",
        Math.round(deg));

    });
}


/* ==========================================================================
   NAVIGATION SAFE
   ========================================================================== */

function navigateTo(view)
{

    document.querySelectorAll(
    ".view-section")
    .forEach(v =>
    {

        v.classList.add("hidden");

    });

    show(view);

}