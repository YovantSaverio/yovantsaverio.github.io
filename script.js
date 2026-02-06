document.addEventListener('DOMContentLoaded', () => {
    // --- Constants & Config ---
    const STORAGE_KEY = 'kalkulator_ips_v2_data';
    const GRADE_SCALE = [
        { min: 80, grade: 'A', point: 4.0 },
        { min: 75, grade: 'B+', point: 3.5 },
        { min: 65, grade: 'B', point: 3.0 },
        { min: 60, grade: 'C+', point: 2.5 },
        { min: 55, grade: 'C', point: 2.0 },
        { min: 40, grade: 'D', point: 1.0 },
        { min: 0, grade: 'E', point: 0.0 }
    ];

    // --- State Management ---
    let appData = {
        activeProfileId: 'default',
        profiles: {
            'default': {
                id: 'default',
                name: 'IPS Saya',
                courses: []
            }
        }
    };

    // --- DOM Elements ---
    const courseListEl = document.getElementById('course-list');
    const addCourseBtn = document.getElementById('add-course-btn');
    const totalSksEl = document.getElementById('total-sks');
    const finalIpsEl = document.getElementById('final-ips');
    const emptyStateEl = document.getElementById('empty-state');

    // Profile Elements
    const profileSelect = document.getElementById('profile-select');
    const btnAddProfile = document.getElementById('btn-add-profile');
    const btnDeleteProfile = document.getElementById('btn-delete-profile');

    // Templates
    const courseTemplate = document.getElementById('course-template');
    const categoryTemplate = document.getElementById('category-template');

    // --- Helper Logic ---
    function roundScore(score) {
        return Math.round(score);
    }

    function getGradeFromScore(score) {
        const rounded = roundScore(score);
        for (const scale of GRADE_SCALE) {
            if (rounded >= scale.min) {
                return { grade: scale.grade, point: scale.point, roundedScore: rounded };
            }
        }
        return { grade: 'E', point: 0.0, roundedScore: rounded };
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // --- Persistence Functions ---
    function loadData() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                appData = JSON.parse(saved);
                // Ensure default structure integrity just in case
                if (!appData.profiles || !appData.activeProfileId) throw new Error("Corrupt Data");
            } catch (e) {
                console.error("Failed to load data, resetting", e);
                // Fallback to default state is already set
            }
        }
        renderProfileList();
        renderCourses();
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        calculateTotalIPS(); // Re-calculate summary whenever data saves (state changes)
    }

    // --- Profile Management ---
    function getActiveProfile() {
        return appData.profiles[appData.activeProfileId];
    }

    function renderProfileList() {
        profileSelect.innerHTML = '';
        Object.values(appData.profiles).forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            if (profile.id === appData.activeProfileId) option.selected = true;
            profileSelect.appendChild(option);
        });
    }

    function switchProfile(profileId) {
        if (appData.profiles[profileId]) {
            appData.activeProfileId = profileId;
            saveData();
            renderProfileList(); // update selected attr
            renderCourses();
        }
    }

    function createNewProfile() {
        const name = prompt("Masukkan nama profil baru (Contoh: Semester 4, atau Nama Teman):");
        if (name && name.trim() !== "") {
            const newId = generateId();
            appData.profiles[newId] = {
                id: newId,
                name: name.trim(),
                courses: []
            };
            switchProfile(newId);
        }
    }

    function deleteCurrentProfile() {
        const profileCount = Object.keys(appData.profiles).length;
        if (profileCount <= 1) {
            alert("Tidak bisa menghapus satu-satunya profil.");
            return;
        }

        if (confirm(`Yakin ingin menghapus profil "${getActiveProfile().name}"? Data akan hilang selamanya.`)) {
            const idToDelete = appData.activeProfileId;
            delete appData.profiles[idToDelete];
            // Switch to first available
            const firstId = Object.keys(appData.profiles)[0];
            switchProfile(firstId);
        }
    }

    // --- Course & Category Management (State + DOM) ---

    // Note: We render directly from state.
    // However, to keep input focus alive and avoid full re-renders on every keystroke,
    // we use a hybrid approach:
    // 1. Initial Render: Build DOM from State.
    // 2. Events: Update State -> Save [-> No full Re-render of strict inputs, just calc].

    function renderCourses() {
        courseListEl.innerHTML = '';
        const profile = getActiveProfile();

        if (profile.courses.length === 0) {
            emptyStateEl.style.display = 'block';
        } else {
            emptyStateEl.style.display = 'none';
            profile.courses.forEach(course => {
                const courseEl = buildCourseElement(course);
                courseListEl.appendChild(courseEl);
                // Trigger an initial calculation for this card to update UI numbers
                updateCourseCardUI(course, courseEl);
            });
        }
        calculateTotalIPS();
    }

    function addCourse() {
        const profile = getActiveProfile();
        const newCourse = {
            id: generateId(),
            name: '',
            sks: 3,
            categories: [
                // Default empty category
                { id: generateId(), name: '', weight: 0, score: 0 }
            ]
        };
        profile.courses.push(newCourse);
        saveData();
        renderCourses();
    }

    function deleteCourse(courseId) {
        const profile = getActiveProfile();
        profile.courses = profile.courses.filter(c => c.id !== courseId);
        saveData();
        renderCourses();
    }

    // --- DOM Builders ---

    function buildCourseElement(courseData) {
        const clone = courseTemplate.content.cloneNode(true);
        const card = clone.querySelector('.course-card');
        card.dataset.id = courseData.id;

        // Inputs
        const nameInput = card.querySelector('.course-name');
        nameInput.value = courseData.name;
        nameInput.addEventListener('input', (e) => {
            courseData.name = e.target.value;
            saveData();
        });

        const sksInput = card.querySelector('.course-sks');
        sksInput.value = courseData.sks;
        sksInput.addEventListener('input', (e) => {
            courseData.sks = parseInt(e.target.value) || 0;
            saveData();
            updateCourseCardUI(courseData, card);
            calculateTotalIPS();
        });

        // Delete Course
        const btnDel = card.querySelector('.btn-delete-course');
        btnDel.addEventListener('click', () => deleteCourse(courseData.id));

        // Categories List
        const catList = card.querySelector('.categories-list');
        courseData.categories.forEach(cat => {
            catList.appendChild(buildCategoryElement(cat, courseData, card));
        });

        // Add Category Button
        const btnAddCat = card.querySelector('.btn-add-category');
        btnAddCat.addEventListener('click', () => {
            const newCat = { id: generateId(), name: '', weight: 0, score: 0 };
            courseData.categories.push(newCat);
            saveData();
            // Append directly to avoid full re-render
            catList.appendChild(buildCategoryElement(newCat, courseData, card));
            updateCourseCardUI(courseData, card);
        });

        return card;
    }

    function buildCategoryElement(catData, courseData, courseCard) {
        const clone = categoryTemplate.content.cloneNode(true);
        const row = clone.querySelector('.category-row');

        const nameIn = row.querySelector('.cat-name');
        nameIn.value = catData.name;
        nameIn.addEventListener('input', (e) => {
            catData.name = e.target.value;
            saveData();
        });

        const weightIn = row.querySelector('.cat-weight');
        weightIn.value = catData.weight > 0 ? catData.weight : ''; // empty if 0 for cleaner look
        weightIn.addEventListener('input', (e) => {
            catData.weight = parseFloat(e.target.value) || 0;
            saveData();
            updateCourseCardUI(courseData, courseCard);
            calculateTotalIPS();
        });

        const scoreIn = row.querySelector('.cat-score');
        scoreIn.value = catData.score > 0 ? catData.score : '';
        scoreIn.addEventListener('input', (e) => {
            catData.score = parseFloat(e.target.value) || 0;
            saveData();
            updateCourseCardUI(courseData, courseCard);
            calculateTotalIPS();
        });

        const btnDel = row.querySelector('.btn-delete-cat');
        btnDel.addEventListener('click', () => {
            courseData.categories = courseData.categories.filter(c => c.id !== catData.id);
            saveData();
            row.remove();
            updateCourseCardUI(courseData, courseCard);
            calculateTotalIPS();
        });

        return row;
    }

    function updateCourseCardUI(courseData, cardEl) {
        let totalWeight = 0;
        let weightedScore = 0;

        courseData.categories.forEach(cat => {
            totalWeight += cat.weight;
            weightedScore += (cat.score * cat.weight / 100);
        });

        // UI Updates
        const weightDisplay = cardEl.querySelector('.weight-val');
        weightDisplay.textContent = totalWeight;
        if (totalWeight !== 100) {
            weightDisplay.classList.add('error');
            weightDisplay.classList.remove('valid');
        } else {
            weightDisplay.classList.remove('error');
            weightDisplay.classList.add('valid');
        }

        const finalData = getGradeFromScore(weightedScore);

        cardEl.querySelector('.course-final-score').textContent =
            `${weightedScore.toFixed(2)} (${finalData.roundedScore})`;

        cardEl.querySelector('.course-letter-grade').textContent =
            `${finalData.grade} (${finalData.point})`;

        // Store calculated point on the object temporarily for Total IPS calculation?
        // Better to re-calculate from data to be safe. 
        // We will do that in calculateTotalIPS using the data object directly.
    }

    function calculateTotalIPS() {
        const profile = getActiveProfile();
        let totalSks = 0;
        let totalWeightedPoints = 0;

        profile.courses.forEach(course => {
            // Need to recalc this course's specific point
            let weightedScore = 0;
            course.categories.forEach(cat => {
                weightedScore += (cat.score * cat.weight / 100);
            });
            const finalData = getGradeFromScore(weightedScore);

            // Only count if SKS > 0
            if (course.sks > 0) {
                totalSks += course.sks;
                totalWeightedPoints += (finalData.point * course.sks);
            }
        });

        totalSksEl.textContent = totalSks;
        const ips = totalSks > 0 ? (totalWeightedPoints / totalSks) : 0;
        finalIpsEl.textContent = ips.toFixed(2);
    }

    // --- Init Listeners ---
    profileSelect.addEventListener('change', (e) => {
        switchProfile(e.target.value);
    });

    btnAddProfile.addEventListener('click', createNewProfile);
    btnDeleteProfile.addEventListener('click', deleteCurrentProfile);
    addCourseBtn.addEventListener('click', addCourse);

    // Boot
    loadData();
});
