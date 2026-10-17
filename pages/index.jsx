import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jyduvkfgbmendzwvlzsj.supabase.co',
  'sb_publishable_ywftAJ2j8hiIsazy8PzFVA_JwELjlL0'
);

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// Screenshot ke exact tabs aur unki sheet color strips
const SHEET_TABS = [
  { id: 'Dashboard', label: 'Dashboard', locked: true, color: '#b91c1c' },
  { id: 'RM Dashboard', label: 'RM Dashboard', locked: false, color: '#15803d' },
  { id: 'O.C Dashboard', label: 'O.C Dashboard', locked: true, color: '#991b1b' },
  { id: 'RM O.C Dashboard', label: 'RM O.C Dashboard', locked: false, color: '#1d4ed8' },
  { id: 'Operator Calling Status', label: 'Operator Calling Status', locked: true, color: '#ca8a04' },
  { id: 'Mock Calling Status', label: 'Mock Calling Status', locked: true, color: '#047857' },
  { id: 'Exam Day Calling Status', label: 'Exam Day Calling Status', locked: true, color: '#7c3aed' },
  { id: 'TV Data Download', label: 'TV Data Download', locked: true, color: '#0284c7' }
];

export default function OpsPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSheetTab, setActiveSheetTab] = useState('Dashboard');
  const [callingFilter, setCallingFilter] = useState('All');
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', shift: '' });

  const [autoSync, setAutoSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const editingRowRef = useRef(editingRow);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('replace');
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('innoview_auth');
    if (session === 'true') {
      setIsAuthenticated(true);
    }
    setAuthChecking(false);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginUser.trim() === ADMIN_USER && loginPass.trim() === ADMIN_PASS) {
      localStorage.setItem('innoview_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Username or Password. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('innoview_auth');
    setIsAuthenticated(false);
    setLoginUser('');
    setLoginPass('');
  };

  useEffect(() => {
    editingRowRef.current = editingRow;
  }, [editingRow]);

  const fetchRecords = async (isBackground = false) => {
    if (!isAuthenticated) return;
    if (!isBackground) setLoading(true);
    setIsSyncing(true);

    let query = supabase.from('duty_roster').select('*').range(0, 4999);
    if (callingFilter !== 'All') {
      query = query.eq('Biometric Calling Status', callingFilter);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Supabase Error:', error);
      if (!isBackground) alert('Supabase Error: ' + error.message);
    } else {
      if (!editingRowRef.current) {
        setRecords(data || []);
      }
    }
    if (!isBackground) setLoading(false);
    setTimeout(() => setIsSyncing(false), 400);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecords(false);
    }
  }, [callingFilter, isAuthenticated]);

  useEffect(() => {
    if (!autoSync || !isAuthenticated) return;
    const interval = setInterval(() => {
      fetchRecords(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoSync, callingFilter, isAuthenticated]);

  const updateStatus = async (id, newStatus) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, 'Biometric Calling Status': newStatus } : r))
    );
    await supabase
      .from('duty_roster')
      .update({ 'Biometric Calling Status': newStatus })
      .eq('id', id);
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    setEditFormData({
      name: row['Biometric Operator Name'] || '',
      phone: row['Biometric Operator Number'] || '',
      shift: row['Total Shift'] || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRow) return;

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editingRow.id
          ? {
              ...r,
              'Biometric Operator Name': editFormData.name,
              'Biometric Operator Number': editFormData.phone,
              'Total Shift': editFormData.shift,
              'Biometric Calling Status': 'Replaced'
            }
          : r
      )
    );

    await supabase
      .from('duty_roster')
      .update({
        'Biometric Operator Name': editFormData.name,
        'Biometric Operator Number': editFormData.phone,
        'Total Shift': editFormData.shift,
        'Biometric Calling Status': 'Replaced'
      })
      .eq('id', editingRow.id);

    setEditingRow(null);
  };

  const handleClearRoster = async () => {
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('duty_roster')
        .delete()
        .neq('Biometric Calling Status', 'IMPOSSIBLE_STATUS_CODE_XYZ');

      if (error) throw error;
      setRecords([]);
      setShowClearModal(false);
      alert('All duty roster records have been cleared successfully.');
    } catch (err) {
      console.error('Clear Error:', err);
      alert('Failed to clear list: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const cleanHeader = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

    const headerMap = {};
    rawHeaders.forEach((h, index) => {
      const ch = cleanHeader(h);
      if (ch.includes('code')) headerMap['Center Code'] = index;
      else if (ch.includes('center') || ch.includes('venue') || ch.includes('college')) headerMap['Center Name'] = index;
      else if (ch.includes('city') || ch.includes('district')) headerMap['City'] = index;
      else if (ch.includes('design') || ch.includes('role')) headerMap['Biometric Designation'] = index;
      else if (ch.includes('shift')) headerMap['Total Shift'] = index;
      else if (ch.includes('operator') || ch.includes('name')) headerMap['Biometric Operator Name'] = index;
      else if (ch.includes('phone') || ch.includes('mobile') || ch.includes('contact') || ch.includes('number')) headerMap['Biometric Operator Number'] = index;
      else if (ch.includes('status')) headerMap['Biometric Calling Status'] = index;
    });

    const parsedData = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length < 2) continue;

      const row = {
        'Center Code': headerMap['Center Code'] !== undefined ? cols[headerMap['Center Code']] : (cols[0] || ''),
        'Center Name': headerMap['Center Name'] !== undefined ? cols[headerMap['Center Name']] : (cols[1] || ''),
        'City': headerMap['City'] !== undefined ? cols[headerMap['City']] : (cols[2] || ''),
        'Biometric Designation': headerMap['Biometric Designation'] !== undefined ? cols[headerMap['Biometric Designation']] : (cols[3] || 'Bio Opr'),
        'Total Shift': headerMap['Total Shift'] !== undefined ? cols[headerMap['Total Shift']] : (cols[4] || 'S1S2'),
        'Biometric Operator Name': headerMap['Biometric Operator Name'] !== undefined ? cols[headerMap['Biometric Operator Name']] : (cols[5] || 'Unassigned'),
        'Biometric Operator Number': headerMap['Biometric Operator Number'] !== undefined ? cols[headerMap['Biometric Operator Number']] : (cols[6] || ''),
        'Biometric Calling Status': (headerMap['Biometric Calling Status'] !== undefined ? cols[headerMap['Biometric Calling Status']] : cols[7]) || 'Pending'
      };
      parsedData.push(row);
    }
    return parsedData;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Reading CSV file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);

        if (rows.length === 0) {
          alert('No valid records found in CSV.');
          setIsUploading(false);
          setUploadStatus('');
          return;
        }

        setUploadStatus(`Preparing ${rows.length} records...`);

        if (uploadMode === 'replace') {
          setUploadStatus('Clearing old roster data...');
          await supabase
            .from('duty_roster')
            .delete()
            .neq('Biometric Calling Status', 'IMPOSSIBLE_STATUS_CODE_XYZ');
        }

        const chunkSize = 200;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          setUploadStatus(`Uploading records ${i + 1} to ${Math.min(i + chunkSize, rows.length)} of ${rows.length}...`);
          const { error: insertError } = await supabase.from('duty_roster').insert(chunk);
          if (insertError) throw new Error(insertError.message);
        }

        setUploadStatus('Syncing complete!');
        setTimeout(() => {
          setIsUploading(false);
          setShowUploadModal(false);
          setUploadStatus('');
          fetchRecords(false);
          alert(`Success! ${rows.length} records updated in InnoView.`);
        }, 600);

      } catch (err) {
        console.error('Upload Error:', err);
        alert('Upload Failed: ' + err.message);
        setIsUploading(false);
        setUploadStatus('');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportCSV = () => {
    if (filtered.length === 0) return alert('No records to export');
    const headers = ['Center Code', 'Center Name', 'City', 'Designation', 'Shift', 'Operator Name', 'Phone', 'Calling Status'];
    const rows = filtered.map((r) => [
      `"${r['Center Code'] || ''}"`,
      `"${(r['Center Name'] || '').replace(/"/g, '""')}"`,
      `"${r['City'] || ''}"`,
      `"${r['Biometric Designation'] || ''}"`,
      `"${r['Total Shift'] || ''}"`,
      `"${(r['Biometric Operator Name'] || '').replace(/"/g, '""')}"`,
      `"${r['Biometric Operator Number'] || ''}"`,
      `"${r['Biometric Calling Status'] || 'Pending'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InnoView_${activeSheetTab.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const counts = {
    total: records.length,
    confirmed: records.filter((r) => r['Biometric Calling Status'] === 'Confirmed').length,
    pending: records.filter((r) => !r['Biometric Calling Status'] || r['Biometric Calling Status'] === 'Pending').length,
    replaced: records.filter((r) => r['Biometric Calling Status'] === 'Replaced').length,
    unreachable: records.filter((r) => r['Biometric Calling Status'] === 'Not Reachable').length
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (r['Center Name'] && String(r['Center Name']).toLowerCase().includes(q)) ||
      (r['Center Code'] && String(r['Center Code']).toLowerCase().includes(q)) ||
      (r['Biometric Operator Name'] && String(r['Biometric Operator Name']).toLowerCase().includes(q)) ||
      (r['Biometric Operator Number'] && String(r['Biometric Operator Number']).toLowerCase().includes(q)) ||
      (r['City'] && String(r['City']).toLowerCase().includes(q));

    // Tab-based view logic
    let matchesTab = true;
    if (activeSheetTab === 'Operator Calling Status') {
      matchesTab = true;
    } else if (activeSheetTab === 'Mock Calling Status') {
      matchesTab = (r['Total Shift'] || '').includes('Mock') || (r['Biometric Calling Status'] || '').includes('Mock');
    } else if (activeSheetTab === 'Exam Day Calling Status') {
      matchesTab = (r['Biometric Calling Status'] === 'Confirmed');
    }

    return matchesSearch && matchesTab;
  });

  if (authChecking) return <div style={{ background: '#f1f5f9', minHeight: '100vh' }}></div>;

  if (!isAuthenticated) {
    return (
      <div style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#090d16',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                <path d="M44 8h12l2.2 9.5a36 36 0 0 1 10.3 4.3L77 15l8.5 8.5-6.8 8.5a36 36 0 0 1 4.3 10.3L92 44.5v12l-9.5 2.2a36 36 0 0 1-4.3 10.3L85 77.5l-8.5 8.5-8.5-6.8a36 36 0 0 1-10.3 4.3L55.5 93h-12l-2.2-9.5a36 36 0 0 1-10.3-4.3L22.5 86 14 77.5l6.8-8.5a36 36 0 0 1-4.3-10.3L7 56.5v-12l9.5-2.2a36 36 0 0 1 4.3-10.3L14 23.5l8.5-8.5 8.5 6.8a36 36 0 0 1 10.3-4.3L44 8z" fill="#ffffff"/>
                <circle cx="50" cy="50" r="28" fill="#090d16" />
                <path d="M 68 36 A 23 23 0 0 1 36 74" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <span style={{ fontSize: '26px', fontWeight: '900', color: '#090d16', letterSpacing: '-0.5px' }}>InnoView</span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 6px 0' }}>Operations Command Center</h2>
          <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 24px 0' }}>Please enter administrator credentials.</p>

          {loginError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Username</label>
              <input type="text" required placeholder="Enter username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Password</label>
              <input type="password" required placeholder="Enter password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '11px', background: '#090d16', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>Sign In to Portal</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f1f5f9',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#0f172a'
    }}>
      
      {/* 1. TOP HEADER */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', flexShrink: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '1680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', userSelect: 'none' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                <path d="M44 8h12l2.2 9.5a36 36 0 0 1 10.3 4.3L77 15l8.5 8.5-6.8 8.5a36 36 0 0 1 4.3 10.3L92 44.5v12l-9.5 2.2a36 36 0 0 1-4.3 10.3L85 77.5l-8.5 8.5-8.5-6.8a36 36 0 0 1-10.3 4.3L55.5 93h-12l-2.2-9.5a36 36 0 0 1-10.3-4.3L22.5 86 14 77.5l6.8-8.5a36 36 0 0 1-4.3-10.3L7 56.5v-12l9.5-2.2a36 36 0 0 1 4.3-10.3L14 23.5l8.5-8.5 8.5 6.8a36 36 0 0 1 10.3-4.3L44 8z" fill="#ffffff"/>
                <circle cx="50" cy="50" r="28" fill="#090d16" />
                <path d="M 68 36 A 23 23 0 0 1 36 74" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#000000', letterSpacing: '-0.8px' }}>InnoView</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => { setActiveSheetTab('Dashboard'); setCallingFilter('All'); setSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0f172a', color: '#ffffff', border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              Dashboard
            </button>
            <button onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#2563eb', color: '#ffffff', border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              📤 Update List (CSV)
            </button>
            <button onClick={() => setShowClearModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '7px 13px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              🗑️ Clear List
            </button>
            <button onClick={() => setAutoSync(!autoSync)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '136px', height: '35px', background: autoSync ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', fontSize: '12px', color: autoSync ? '#15803d' : '#64748b', border: autoSync ? '1px solid #bbf7d0' : '1px solid #e2e8f0', fontWeight: 600, cursor: 'pointer' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: autoSync ? (isSyncing ? '#22c55e' : '#16a34a') : '#94a3b8' }}></span>
              <span>{autoSync ? 'Auto-Sync: 3s' : 'Auto-Sync: OFF'}</span>
            </button>
            <button onClick={exportCSV} style={{ background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              📥 Export CSV
            </button>
            <button onClick={handleLogout} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '7px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              🔒 Logout
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main style={{
        maxWidth: '1680px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 24px 12px 24px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box'
      }}>
        
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px', flexShrink: 0 }}>
          <div onClick={() => setCallingFilter('All')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: callingFilter === 'All' ? '2px solid #2563eb' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>TOTAL DEPLOYED <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>100%</span></div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{counts.total}</div>
          </div>
          <div onClick={() => setCallingFilter('Confirmed')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: callingFilter === 'Confirmed' ? '2px solid #16a34a' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '11px', fontWeight: 700 }}>CONFIRMED <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{counts.total ? Math.round((counts.confirmed / counts.total) * 100) : 0}%</span></div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#16a34a' }}>{counts.confirmed}</div>
          </div>
          <div onClick={() => setCallingFilter('Pending')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: callingFilter === 'Pending' ? '2px solid #ca8a04' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ca8a04', fontSize: '11px', fontWeight: 700 }}>PENDING CALLS <span style={{ background: '#fef9c3', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{counts.total ? Math.round((counts.pending / counts.total) * 100) : 0}%</span></div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#ca8a04' }}>{counts.pending}</div>
          </div>
          <div onClick={() => setCallingFilter('Replaced')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: callingFilter === 'Replaced' ? '2px solid #2563eb' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontSize: '11px', fontWeight: 700 }}>REPLACED / BACKUP <span style={{ background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{counts.total ? Math.round((counts.replaced / counts.total) * 100) : 0}%</span></div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#2563eb' }}>{counts.replaced}</div>
          </div>
          <div onClick={() => setCallingFilter('Not Reachable')} style={{ cursor: 'pointer', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: callingFilter === 'Not Reachable' ? '2px solid #dc2626' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontSize: '11px', fontWeight: 700 }}>NOT REACHABLE <span style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{counts.total ? Math.round((counts.unreachable / counts.total) * 100) : 0}%</span></div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#dc2626' }}>{counts.unreachable}</div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input type="text" placeholder="Search by center code, center name, city, operator name or mobile number..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }} />
          </div>
          <select value={callingFilter} onChange={(e) => setCallingFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 500, cursor: 'pointer', outline: 'none' }}>
            <option value="All">Filter: All Statuses</option>
            <option value="Confirmed">Confirmed Only</option>
            <option value="Pending">Pending Only</option>
            <option value="Not Reachable">Not Reachable Only</option>
            <option value="Replaced">Replaced Only</option>
          </select>
          <button onClick={() => fetchRecords(false)} style={{ padding: '9px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#334155' }}>
            🔄 Sync Data
          </button>
        </div>

        {/* DATA TABLE CONTAINER */}
        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ background: '#0f172a', color: '#f8fafc', position: 'sticky', top: 0, zIndex: 20, letterSpacing: '0.4px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '12px 14px', width: '85px' }}>Code</th>
                  <th style={{ padding: '12px 14px', minWidth: '280px' }}>Exam Center Details</th>
                  <th style={{ padding: '12px 14px', width: '130px' }}>City</th>
                  <th style={{ padding: '12px 14px', width: '100px' }}>Designation</th>
                  <th style={{ padding: '12px 14px', width: '75px' }}>Shift</th>
                  <th style={{ padding: '12px 14px', minWidth: '220px' }}>Operator Details</th>
                  <th style={{ padding: '12px 14px', width: '185px' }}>Calling Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>Fetching live database records...</div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                      No matching exam records found for <strong>{activeSheetTab}</strong>.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, index) => {
                    const status = row['Biometric Calling Status'] || 'Pending';
                    const isConfirmed = status === 'Confirmed';
                    const isReplaced = status === 'Replaced';
                    const isUnreachable = status === 'Not Reachable';

                    return (
                      <tr key={row.id || index} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid #dbeafe' }}>
                            {row['Center Code']}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.35 }}>{row['Center Name']}</div>
                        </td>
                        <td style={{ padding: '11px 14px', color: '#475569', fontWeight: 500 }}>{row['City']}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {row['Biometric Designation'] || 'Bio Opr'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {row['Total Shift'] || 'S1S2'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row['Biometric Operator Name'] || 'Unassigned'}</div>
                          {row['Biometric Operator Number'] ? (
                            <a href={`tel:${row['Biometric Operator Number']}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2563eb', textDecoration: 'none', marginTop: '2px', fontWeight: 500 }}>
                              📞 {row['Biometric Operator Number']}
                            </a>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>No phone</span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <select
                            value={status}
                            onChange={(e) => updateStatus(row.id, e.target.value)}
                            style={{
                              width: '100%',
                              minWidth: '155px',
                              padding: '7px 10px',
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                              boxSizing: 'border-box',
                              border: isConfirmed ? '1px solid #86efac' : isReplaced ? '1px solid #bfdbfe' : isUnreachable ? '1px solid #fca5a5' : '1px solid #fde047',
                              background: isConfirmed ? '#dcfce7' : isReplaced ? '#eff6ff' : isUnreachable ? '#fee2e2' : '#fef9c3',
                              color: isConfirmed ? '#15803d' : isReplaced ? '#1d4ed8' : isUnreachable ? '#b91c1c' : '#a16207'
                            }}
                          >
                            <option value="Pending">⏳ Pending</option>
                            <option value="Confirmed">✅ Confirmed</option>
                            <option value="Replaced">🔄 Replaced</option>
                            <option value="Not Reachable">❌ Not Reachable</option>
                          </select>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <button onClick={() => openEditModal(row)} style={{ padding: '5px 11px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#334155' }}>
                            ✏️ Reassign
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 3. GOOGLE SHEETS EXACT BOTTOM TABS BAR */}
          <div style={{
            background: '#e9eef4',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            flexShrink: 0,
            overflowX: 'auto',
            userSelect: 'none',
            height: '38px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '100%' }}>
              
              {/* Plus (+) Button like Google Sheets */}
              <button 
                title="Add Sheet"
                onClick={() => alert('New Custom Sheet tab feature coming soon!')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#475569',
                  borderRadius: '4px'
                }}
              >
                ＋
              </button>

              {/* Exact Screenshot Tabs with Lock icons & Dropdown arrows */}
              {SHEET_TABS.map((tab) => {
                const isActive = activeSheetTab === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveSheetTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0 12px',
                      height: '100%',
                      background: isActive ? '#dbeafe' : 'transparent',
                      color: isActive ? '#1d4ed8' : '#334155',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      borderRight: '1px solid #cbd5e1',
                      borderBottom: `3px solid ${tab.color}`,
                      whiteSpace: 'nowrap',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Lock Icon */}
                    {tab.locked && (
                      <span style={{ fontSize: '11px', color: isActive ? '#1d4ed8' : '#64748b' }}>
                        🔒
                      </span>
                    )}

                    <span>{tab.label}</span>

                    {/* Dropdown Arrow */}
                    <span style={{ fontSize: '9px', marginLeft: '2px', color: isActive ? '#1d4ed8' : '#64748b' }}>
                      ▼
                    </span>
                  </div>
                );
              })}

            </div>

            {/* Right side live count indicator */}
            <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', fontWeight: 600, paddingRight: '8px', whiteSpace: 'nowrap' }}>
              Showing {filtered.length} entries in <strong>{activeSheetTab}</strong>
            </div>
          </div>

        </div>

        {/* Modal 1: Upload / Replace CSV */}
        {showUploadModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#fff', borderRadius: '14px', width: '520px', maxWidth: '94%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ background: '#0f172a', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Update Center Roster List</h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Upload a new CSV file to refresh duty roster records</p>
                </div>
                {!isUploading && (
                  <button onClick={() => setShowUploadModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                )}
              </div>

              <div style={{ padding: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Update Action:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  <button type="button" onClick={() => setUploadMode('replace')} style={{ padding: '10px', borderRadius: '8px', border: uploadMode === 'replace' ? '2px solid #2563eb' : '1px solid #cbd5e1', background: uploadMode === 'replace' ? '#eff6ff' : '#fff', color: uploadMode === 'replace' ? '#1d4ed8' : '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                    🔄 Replace Entire List
                  </button>
                  <button type="button" onClick={() => setUploadMode('append')} style={{ padding: '10px', borderRadius: '8px', border: uploadMode === 'append' ? '2px solid #2563eb' : '1px solid #cbd5e1', background: uploadMode === 'append' ? '#eff6ff' : '#fff', color: uploadMode === 'append' ? '#1d4ed8' : '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                    ➕ Append To Existing
                  </button>
                </div>

                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '24px 16px', textAlign: 'center', background: '#f8fafc', marginBottom: '16px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Select your CSV / Excel Roster File</div>
                  <input type="file" accept=".csv" ref={fileInputRef} disabled={isUploading} onChange={handleFileUpload} style={{ fontSize: '12px', cursor: 'pointer' }} />
                </div>

                {uploadStatus && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '12px', color: '#2563eb', fontWeight: 600, textAlign: 'center', marginBottom: '10px' }}>
                    ⏳ {uploadStatus}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" disabled={isUploading} onClick={() => setShowUploadModal(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Confirm Clear */}
        {showClearModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
            <div style={{ background: '#fff', borderRadius: '14px', width: '420px', maxWidth: '92%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', border: '1px solid #fee2e2', overflow: 'hidden' }}>
              <div style={{ background: '#dc2626', padding: '16px 20px', color: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>⚠️ Clear Entire Roster List?</h3>
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                  Are you sure you want to delete all <strong>{records.length} records</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" disabled={isClearing} onClick={() => setShowClearModal(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Cancel
                  </button>
                  <button type="button" disabled={isClearing} onClick={handleClearRoster} style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    {isClearing ? 'Deleting...' : 'Yes, Delete All'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Reassign */}
        {editingRow && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#fff', borderRadius: '12px', width: '440px', maxWidth: '92%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ background: '#0b132b', padding: '16px 20px', color: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Reassign Center Operator</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{editingRow['Center Name']} ({editingRow['Center Code']})</p>
              </div>
              
              <form onSubmit={handleSaveEdit} style={{ padding: '20px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Operator Full Name</label>
                  <input type="text" required value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Operator Mobile Number</label>
                  <input type="text" required value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Assigned Shift</label>
                  <input type="text" value={editFormData.shift} onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setEditingRow(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Save & Mark Replaced
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
