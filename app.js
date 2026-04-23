// Global Configurations
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwm8kRsJJwjNToMqIoTX3stVhHN9SYfDvdsINkMjHwnOhGmWzG5lv1-dsPivYmvCbP9/exec";

// User Session Management
function getCurrentUser() {
    return {
        id: localStorage.getItem('census_user_id') || 'Guest',
        role: localStorage.getItem('census_user_role') || 'enumerator'
    };
}

// Census Data Access Helpers
function getSyncedRecords() {
    const user = getCurrentUser();
    const syncedKey = 'census_synced_records_' + user.id;
    const manualData = localStorage.getItem(syncedKey);
    let manualRecords = manualData ? JSON.parse(manualData) : [];
    
    // Always generate the 15 core training records
    const dummyData = [];
    const today = new Date().toLocaleDateString('hi-IN');
    const dummyPeople = [
        {name: "Manoj", members: "5"}, {name: "Rajesh", members: "4"},
        {name: "Suman", members: "3"}, {name: "Prakash", members: "6"},
        {name: "Amit", members: "5"}, {name: "Suresh", members: "4"},
        {name: "Kiran", members: "2"}, {name: "Anita", members: "5"},
        {name: "Sunil", members: "3"}, {name: "Meena", members: "4"},
        {name: "Vijay", members: "6"}, {name: "Radha", members: "5"},
        {name: "Deepak", members: "4"}, {name: "Geeta", members: "3"},
        {name: "Rahul", members: "5"}
    ];

    const baseAnswers = {
        "q4": "1-मिट्टी", "q5": "1-घास/फूस/बांस आदि", "q6": "1-घास/फूस/बांस/लकड़ी/मिट्टी आदि",
        "q7": "1-आवास", "q8": "1-अच्छी", "q12": "1-पुरुष", "q13": "1-अनुसूचित जाति (SC)",
        "q14": "1-अपना", "q15": "3", "q16": "2", "q17": "1-नल का पानी उपचारित स्रोत से"
    };

    dummyPeople.forEach((p, i) => {
        const bNo = (i+1).toString().padStart(4, '0');
        dummyData.push({
            id: 'REC-DUMMY-' + (i+1).toString().padStart(3, '0'),
            q1: bNo, q2: "0001", line: (i+1).toString().padStart(3, '0'),
            date: today, status: 'Approved',
            answers: { ...baseAnswers, q1: bNo, q2: "0001", q3: "0001", q9: "001", q10: p.members, q11: p.name }
        });
    });

    // Merge manual records with training data (training data comes first)
    // Avoid duplicate IDs if user edited a training record
    const finalRecords = [...dummyData];
    manualRecords.forEach(m => {
        if (!finalRecords.find(d => d.id === m.id)) finalRecords.push(m);
    });
    
    return finalRecords;
}

function getPendingRecords(userId) {
    const user = userId || getCurrentUser().id;
    const data = localStorage.getItem('census_pending_records_' + user);
    let records = [];
    try {
        if (data) records = JSON.parse(data);
    } catch(e) {}
    return Array.isArray(records) ? records : [];
}

function getAllRecords() {
    const synced = getSyncedRecords();
    const pending = getPendingRecords();
    let all = [];
    synced.forEach(r => all.push({ ...r, status: 'Approved' }));
    pending.forEach(r => all.push({ ...r, status: 'Pending' }));
    
    const unique = [];
    const seen = new Set();
    
    all.sort((a, b) => {
        const aPend = a.status === 'Pending' ? 1 : 0;
        const bPend = b.status === 'Pending' ? 1 : 0;
        if (aPend !== bPend) return bPend - aPend;
        return b.id.localeCompare(a.id);
    });
    
    all.forEach(r => {
        if (r && r.id && !seen.has(r.id)) {
            seen.add(r.id);
            unique.push(r);
        }
    });
    return unique;
}

async function savePendingRecord(answers, editIndex = null) {
    const user = getCurrentUser();
    const storageKey = 'census_pending_records_' + user.id;
    const finalAnswers = answers || {};
    
    try {
        let records = getPendingRecords(user.id);
        
        const q1 = finalAnswers.q1 || getFormState('q1') || '0001';
        const q2 = finalAnswers.q2 || getFormState('q2') || '0001';
        const line = finalAnswers.line || getFormState('line') || '001';
        
        const editingId = getFormState('editing_id');

        const newRecord = {
            id: editingId || ('REC-PEND-' + Date.now()),
            q1: q1, q2: q2, line: line,
            date: new Date().toLocaleDateString('hi-IN'),
            status: 'Pending',
            answers: finalAnswers
        };

        // AGGRESSIVE DEDUPLICATION: Find by ID OR by (Building + House)
        let existingIdx = records.findIndex(r => r.id === newRecord.id);
        
        // If not found by ID, check if this building + house already exists in pending
        if (existingIdx === -1) {
            existingIdx = records.findIndex(r => r.q1 === q1 && r.q2 === q2);
        }

        if (existingIdx !== -1) {
            // Keep the old ID if we found it by Building+House to prevent fragmentation
            if (records[existingIdx].id) newRecord.id = records[existingIdx].id;
            records[existingIdx] = newRecord;
            console.log("Success: Existing record updated");
        } else if (editIndex !== null && records[editIndex]) {
            records[editIndex] = newRecord;
            console.log("Success: Record updated by index");
        } else {
            records.push(newRecord);
            console.log("Success: New record added");
        }

        localStorage.setItem(storageKey, JSON.stringify(records));
        localStorage.setItem('census_pending_records_backup', JSON.stringify(records));
        
        // Background sync
        syncToGoogleSheet([newRecord]);
        return true;
    } catch (e) {
        console.error("Save Error:", e);
        throw e;
    }
}

function syncToGoogleSheet(records) {
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
    }).catch(err => console.warn("Background sync failed."));
}

// Census Numbering Logic
function getNextLineNumber() {
    const records = getPendingRecords();
    const synced = getSyncedRecords();
    return (records.length + synced.length + 1).toString().padStart(3, '0');
}

function getNextBuildingNumber() {
    const all = [...getSyncedRecords(), ...getPendingRecords()];
    if (all.length === 0) return '0001';
    let max = 0;
    all.forEach(r => {
        const n = parseInt(r.q1 || (r.answers ? r.answers.q1 : 0));
        if (!isNaN(n) && n > max) max = n;
    });
    return (max + 1).toString().padStart(4, '0');
}

function getNextHouseNumber() {
    const all = [...getSyncedRecords(), ...getPendingRecords()];
    if (all.length === 0) return '0001';
    let max = 0;
    all.forEach(r => {
        const n = parseInt(r.q2 || (r.answers ? r.answers.q2 : 0));
        if (!isNaN(n) && n > max) max = n;
    });
    return (max + 1).toString().padStart(4, '0');
}

// State Management
function setFormState(key, value) {
    const state = JSON.parse(localStorage.getItem('census_form_state') || '{}');
    state[key] = value;
    localStorage.setItem('census_form_state', JSON.stringify(state));
}

function getFormState(key) {
    const state = JSON.parse(localStorage.getItem('census_form_state') || '{}');
    return state[key];
}

function clearFormState() {
    localStorage.removeItem('census_form_state');
}

function logout() {
    const user = getCurrentUser();
    localStorage.removeItem('census_synced_records_' + user.id);
    localStorage.removeItem('census_pending_records_' + user.id);
    localStorage.removeItem('census_user_id');
    localStorage.removeItem('census_user_role');
    localStorage.removeItem('census_form_state');
    window.location.href = 'index.html';
}

/**
 * DYNAMIC SUPERVISOR DATA: Merges real E001 work with 5 other mock enumerators
 */
function getSupervisorMockData() {
    const enumIds = ['e001', 'P002', 'P003', 'P004', 'P005', 'P006'];
    const names = ["जितेंद्र (E001)", "सुनीता शर्मा", "राजेश मीना", "गीता देवी", "विजय सिंह", "संजू वर्मा"];
    const data = {};

    enumIds.forEach((id, idx) => {
        // Start with empty records
        let records = [];

        if (id === 'e001') {
            // LIVE DATA: Fetch actual records saved by E001 (synced ones)
            const realSynced = JSON.parse(localStorage.getItem('census_synced_records_e001') || '[]');
            const realPending = JSON.parse(localStorage.getItem('census_pending_records_e001') || '[]');
            records = [...realSynced, ...realPending];
            
            // If E001 has no work yet, give them 2 starter records for demo
            if (records.length === 0) {
                records = [
                    { id: `LIVE-E001-1`, line: '001', q1: '1001', answers: { q1: '1001', q2: '0001', q9: '001', q11: 'राम सिंह' }, status: 'Pending' }
                ];
            }
        } else {
            // MOCK DATA for others
            records = [
                { id: `MOCK-${id}-1`, line: '001', q1: '0101', answers: { q1: '0101', q2: '0001', q9: '001', q11: 'रामेश्वर लाल' }, status: 'Pending' },
                { id: `MOCK-${id}-2`, line: '002', q1: '0101', answers: { q1: '0101', q2: '0002', q9: '002', q11: 'कमला बाई' }, status: 'Pending' }
            ];
            if (idx % 2 === 0) {
                records.push({ id: `MOCK-${id}-3`, line: '003', q1: '0102', answers: { q1: '0102', q2: '0003', q9: '003', q11: 'हरीश चन्द्र' }, status: 'Pending' });
            }
        }

/**
 * SUPERVISOR ACTIONS: Approve or Reject (Remark) a record
 */
function updateSupervisorRecord(enumId, recId, newStatus, remark = '') {
    // If it's the real E001, update their local storage directly
    if (enumId === 'e001') {
        const storageKey = 'census_synced_records_e001';
        let records = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const idx = records.findIndex(r => r.id === recId);
        if (idx !== -1) {
            records[idx].status = newStatus;
            records[idx].supervisor_remark = remark;
            localStorage.setItem(storageKey, JSON.stringify(records));
        }
    }
    // For mock records, we just simulate success
    console.log(`Supervisor Action: ${newStatus} on ${recId} for ${enumId}. Remark: ${remark}`);
    return true;
}

function showAbout() {
    alert("यह जनगणना पोर्टल जितेंद्र कुमार चौधरी द्वारा ट्रेनिंग हेतु विकसित किया गया है।");
}

function showMap() {
    window.open('hlb_map.png', '_blank');
}
