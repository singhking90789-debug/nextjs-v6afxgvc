import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jyduvkfgbmendzwvlzsj.supabase.co',
  'sb_publishable_ywftAJ2j8hiIsazy8PzFVA_JwELjlL0'
);

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

export default function OpsPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
      setLoginError('Invalid Administrator credentials.');
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

    try {
      let query = supabase.from('duty_roster').select('*').range(0, 4999);
      if (callingFilter !== 'All') {
        query = query.eq('Biometric Calling Status', callingFilter);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Supabase Error:', error);
      } else {
        if (!editingRowRef.current) {
          setRecords(data || []);
        }
      }
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      if (!isBackground) setLoading(false);
      setTimeout(() => setIsSyncing(false), 400);
    }
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
      alert('Duty roster cleared successfully.');
    } catch (err) {
      alert('Failed to clear: ' + err.message);
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
    setUploadStatus('Processing Roster File...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);

        if (rows.length === 0) {
          alert('No valid records found in CSV.');
          setIsUploading(false);
          return;
        }

        if (uploadMode === 'replace') {
          await supabase
            .from('duty_roster')
            .delete()
            .neq('Biometric Calling Status', 'IMPOSSIBLE_STATUS_CODE_XYZ');
        }

        const chunkSize = 200;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error: insertError } = await supabase.from('duty_roster').insert(chunk);
          if (insertError) throw new Error(insertError.message);
        }

        setIsUploading(false);
        setShowUploadModal(false);
        fetchRecords(false);
        alert(`Success! Updated ${rows.length} operational units.`);
      } catch (err) {
        alert('Upload Error: ' + err.message);
        setIsUploading(false);
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
    link.setAttribute('download', `InnoView_Command_Ops_${new Date().toISOString().slice(0, 10)}.csv`);
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
    return (
      (r['Center Name'] && String(r['Center Name']).toLowerCase().includes(q)) ||
      (r['Center Code'] && String(r['Center Code']).toLowerCase().includes(q)) ||
      (r['Biometric Operator Name'] && String(r['Biometric Operator Name']).toLowerCase().includes(q)) ||
      (r['Biometric Operator Number'] && String(r['Biometric Operator Number']).toLowerCase().includes(q)) ||
      (r['City'] && String(r['City']).toLowerCase().includes(q))
    );
  });

  if (authChecking) {
    return <div style={{ background: '#090d16', minHeight: '100vh' }}></div>;
  }

  // SIGN IN
  if (!isAuthenticated) {
    return (
      <div style={{
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
        background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #090d16 80%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.96)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '420px',
          padding: '40px 36px',
          boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '28px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
            }}>
              <span style={{ fontSize: '22px' }}>⚡</span>
            </div>
            <div>
              <span style={{ fontSize: '26px', fontWeight: '900', color: '#090d16', letterSpacing: '-0.8px' }}>
                InnoView
              </span>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#6366f1', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Command Center
              </span>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Secure Enterprise Gatekeeper. Please authenticate to monitor live rosters.
          </p>

          {loginError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', color: '#b91c1c', padding: '11px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, marginBottom: '18px', textAlign: 'center' }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                ADMIN USERNAME
              </label>
              <input
                type="text"
                required
                placeholder="Enter admin ID"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                PASSPHRASE
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #090d16, #1e293b)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 20px -5px rgba(0,0,0,0.4)',
                letterSpacing: '0.3px'
              }}
            >
              Sign In To Portal →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN PORTAL
  return (
    <div style={{
      fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f8fafc',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#0f172a'
    }}>
      
      {/* 1. TOP PREMIUM HEADER */}
      <header style={{
        background: '#090d16',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 28px',
        flexShrink: 0,
        zIndex: 30,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ maxWidth: '1720px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.45)'
            }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.8px' }}>
                  InnoView
                </span>
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc', fontSize: '10px', padding: '2px 7px', borderRadius: '20px', fontWeight: 700 }}>
                  PRO v2.5
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                Operations Command & Roster Intelligence
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                setCallingFilter('All');
                setSearch('');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📊 Reset View
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 15px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📤 Import Roster (CSV)
            </button>

            <button
              onClick={() => setShowClearModal(true)}
              style={{
                background: 'rgba(225, 29, 72, 0.15)',
                color: '#fb7185',
                border: '1px solid rgba(225, 29, 72, 0.3)',
                padding: '8px 13px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🗑️ Purge Roster
            </button>

            <button
              onClick={() => setAutoSync(!autoSync)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: autoSync ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                fontSize: '12px',
                color: autoSync ? '#34d399' : '#94a3b8',
                border: autoSync ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                padding: '8px 12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: autoSync ? (isSyncing ? '#34d399' : '#10b981') : '#64748b',
                boxShadow: autoSync ? '0 0 8px #10b981' : 'none'
              }}></span>
              {autoSync ? 'Live Engine: 3s' : 'Sync: Paused'}
            </button>

            <button
              onClick={exportCSV}
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              📥 Export Data
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🔒 Logout
            </button>
          </div>

        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main style={{
        maxWidth: '1720px',
        width: '100%',
        margin: '0 auto',
        padding: '18px 28px 14px 28px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box'
      }}>
        
        {/* KPI SUMMARY CARDS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '16px',
          flexShrink: 0
        }}>
          
          {/* Card 1: Total */}
          <div
            onClick={() => setCallingFilter('All')}
            style={{
              cursor: 'pointer',
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '14px',
              border: callingFilter === 'All' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>TOTAL UNITS</span>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>100%</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: '#090d16' }}>{counts.total}</div>
            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '3px', marginTop: '10px' }}>
              <div style={{ width: '100%', height: '100%', background: '#3b82f6', borderRadius: '3px' }}></div>
            </div>
          </div>

          {/* Card 2: Confirmed */}
          <div
            onClick={() => setCallingFilter('Confirmed')}
            style={{
              cursor: 'pointer',
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '14px',
              border: callingFilter === 'Confirmed' ? '2px solid #10b981' : '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', letterSpacing: '0.5px' }}>CONFIRMED</span>
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                {counts.total ? Math.round((counts.confirmed / counts.total) * 100) : 0}%
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: '#059669' }}>{counts.confirmed}</div>
            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '3px', marginTop: '10px' }}>
              <div style={{ width: `${counts.total ? (counts.confirmed / counts.total) * 100 : 0}%`, height: '100%', background: '#10b981', borderRadius: '3px' }}></div>
            </div>
          </div>

          {/* Card 3: Pending */}
          <div
            onClick={() => setCallingFilter('Pending')}
            style={{
              cursor: 'pointer',
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '14px',
              border: callingFilter === 'Pending' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', letterSpacing: '0.5px' }}>PENDING CALLS</span>
              <span style={{ background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                {counts.total ? Math.round((counts.pending / counts.total) * 100) : 0}%
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: '#d97706' }}>{counts.pending}</div>
            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '3px', marginTop: '10px' }}>
              <div style={{ width: `${counts.total ? (counts.pending / counts.total) * 100 : 0}%`, height: '100%', background: '#f59e0b', borderRadius: '3px' }}></div>
            </div>
          </div>

          {/* Card 4: Replaced */}
          <div
            onClick={() => setCallingFilter('Replaced')}
            style={{
              cursor: 'pointer',
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '14px',
              border: callingFilter === 'Replaced' ? '2px solid #6366f1' : '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.5px' }}>BACKUP REPLACED</span>
              <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                {counts.total ? Math.round((counts.replaced / counts.total) * 100) : 0}%
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: '#4f46e5' }}>{counts.replaced}</div>
            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '3px', marginTop: '10px' }}>
              <div style={{ width: `${counts.total ? (counts.replaced / counts.total) * 100 : 0}%`, height: '100%', background: '#6366f1', borderRadius: '3px' }}></div>
            </div>
          </div>

          {/* Card 5: Unreachable */}
          <div
            onClick={() => setCallingFilter('Not Reachable')}
            style={{
              cursor: 'pointer',
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '14px',
              border: callingFilter === 'Not Reachable' ? '2px solid #ef4444' : '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', letterSpacing: '0.5px' }}>NOT REACHABLE</span>
              <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                {counts.total ? Math.round((counts.unreachable / counts.total) * 100) : 0}%
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: '#dc2626' }}>{counts.unreachable}</div>
            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '3px', marginTop: '10px' }}>
              <div style={{ width: `${counts.total ? (counts.unreachable / counts.total) * 100 : 0}%`, height: '100%', background: '#ef4444', borderRadius: '3px' }}></div>
            </div>
          </div>

        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div style={{
          background: '#ffffff',
          padding: '12px 18px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '14px',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '15px' }}>🔍</span>
            <input
              type="text"
              placeholder="Search by center code, venue name, city, operator name or contact number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '9px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                outline: 'none',
                background: '#f8fafc',
                boxSizing: 'border-box',
                transition: 'border 0.2s'
              }}
            />
          </div>

          <select
            value={callingFilter}
            onChange={(e) => setCallingFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '9px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              color: '#334155'
            }}
          >
            <option value="All">All Operations ({records.length})</option>
            <option value="Confirmed">✅ Confirmed Only</option>
            <option value="Pending">⏳ Pending Only</option>
            <option value="Not Reachable">❌ Not Reachable Only</option>
            <option value="Replaced">🔄 Backup Replaced Only</option>
          </select>

          <button
            onClick={() => fetchRecords(false)}
            style={{
              padding: '10px 16px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔄 Sync Live Data
          </button>
        </div>

        {/* HIGH-END DATA TABLE */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
        }}>
          
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{
                background: '#090d16',
                color: '#f8fafc',
                position: 'sticky',
                top: 0,
                zIndex: 20,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                fontSize: '11px',
                fontWeight: 800
              }}>
                <tr>
                  <th style={{ padding: '14px 16px', width: '90px' }}>CODE</th>
                  <th style={{ padding: '14px 16px', minWidth: '300px' }}>EXAM CENTER VENUE</th>
                  <th style={{ padding: '14px 16px', width: '130px' }}>CITY</th>
                  <th style={{ padding: '14px 16px', width: '110px' }}>ROLE</th>
                  <th style={{ padding: '14px 16px', width: '80px' }}>SHIFT</th>
                  <th style={{ padding: '14px 16px', minWidth: '220px' }}>OPERATOR DETAILS</th>
                  <th style={{ padding: '14px 16px', width: '190px' }}>CALLING STATUS</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '110px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '70px 0', color: '#64748b' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>Connecting to Supabase Cloud Engine...</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Streaming duty roster records in real-time</div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '70px 0', color: '#64748b' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>No Operational Records Found</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Try adjusting your search query or status filter.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, index) => {
                    const status = row['Biometric Calling Status'] || 'Pending';
                    const isConfirmed = status === 'Confirmed';
                    const isReplaced = status === 'Replaced';
                    const isUnreachable = status === 'Not Reachable';

                    return (
                      <tr
                        key={row.id || index}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: index % 2 === 0 ? '#ffffff' : '#fafafa',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid #dbeafe' }}>
                            {row['Center Code']}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>{row['Center Name']}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>
                          {row['City']}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.3px' }}>
                            {row['Biometric Designation'] || 'Bio Opr'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                            {row['Total Shift'] || 'S1S2'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#090d16' }}>{row['Biometric Operator Name'] || 'Unassigned'}</div>
                          {row['Biometric Operator Number'] ? (
                            <a
                              href={`tel:${row['Biometric Operator Number']}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#2563eb', textDecoration: 'none', marginTop: '3px', fontWeight: 600 }}
                            >
                              📞 {row['Biometric Operator Number']}
                            </a>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>No Mobile</span>
                          )}
                        </td>

                        {/* WIDE STATUS PILL DROPDOWN */}
                        <td style={{ padding: '12px 16px' }}>
                          <select
                            value={status}
                            onChange={(e) => updateStatus(row.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              outline: 'none',
                              boxSizing: 'border-box',
                              border: isConfirmed ? '1px solid #86efac' : isReplaced ? '1px solid #bfdbfe' : isUnreachable ? '1px solid #fca5a5' : '1px solid #fde047',
                              background: isConfirmed ? '#ecfdf5' : isReplaced ? '#eff6ff' : isUnreachable ? '#fef2f2' : '#fffbeb',
                              color: isConfirmed ? '#059669' : isReplaced ? '#2563eb' : isUnreachable ? '#dc2626' : '#d97706',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                          >
                            <option value="Pending">⏳ Pending</option>
                            <option value="Confirmed">✅ Confirmed</option>
                            <option value="Replaced">🔄 Replaced</option>
                            <option value="Not Reachable">❌ Not Reachable</option>
                          </select>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => openEditModal(row)}
                            style={{
                              padding: '6px 12px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              color: '#334155',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
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

          {/* Table Footer Summary */}
          <div style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
            flexShrink: 0,
            fontWeight: 600
          }}>
            <span>Displaying <strong>{filtered.length}</strong> matching entries • Total Network: <strong>{records.length}</strong></span>
            <span>⚡ InnoView Operations Hub • Supabase Secured</span>
          </div>

        </div>

        {/* MODAL 1: CSV UPLOAD */}
        {showUploadModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#ffffff', borderRadius: '18px', width: '500px', maxWidth: '94%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ background: '#090d16', padding: '20px 24px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Import Operational Roster</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Upload a CSV roster file to sync with live database</p>
                </div>
                {!isUploading && (
                  <button onClick={() => setShowUploadModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                )}
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  <button
                    type="button"
                    onClick={() => setUploadMode('replace')}
                    style={{
                      padding: '11px',
                      borderRadius: '9px',
                      border: uploadMode === 'replace' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: uploadMode === 'replace' ? '#eff6ff' : '#ffffff',
                      color: uploadMode === 'replace' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Replace Entire Roster
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('append')}
                    style={{
                      padding: '11px',
                      borderRadius: '9px',
                      border: uploadMode === 'append' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: uploadMode === 'append' ? '#eff6ff' : '#ffffff',
                      color: uploadMode === 'append' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ➕ Append Records
                  </button>
                </div>

                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '28px 16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                    Select your CSV / Excel Roster File
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    disabled={isUploading}
                    onChange={handleFileUpload}
                    style={{ fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}
                  />
                </div>

                {uploadStatus && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1d4ed8', fontWeight: 700, textAlign: 'center', marginBottom: '12px' }}>
                    ⏳ {uploadStatus}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setShowUploadModal(false)}
                    style={{ padding: '9px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#475569' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: CONFIRM CLEAR */}
        {showClearModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', width: '420px', maxWidth: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid #fee2e2', overflow: 'hidden' }}>
              <div style={{ background: '#dc2626', padding: '18px 22px', color: '#ffffff' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>⚠️ Purge All Duty Roster Records?</h3>
              </div>
              <div style={{ padding: '22px' }}>
                <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                  Are you sure you want to delete all <strong>{records.length} operational units</strong>? This action will completely clear the database table.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={isClearing}
                    onClick={() => setShowClearModal(false)}
                    style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isClearing}
                    onClick={handleClearRoster}
                    style={{ padding: '9px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                  >
                    {isClearing ? 'Deleting...' : 'Yes, Delete All'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: REASSIGN */}
        {editingRow && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 13, 22, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', width: '440px', maxWidth: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ background: '#090d16', padding: '18px 22px', color: '#ffffff' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Reassign Center Operator</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {editingRow['Center Name']} ({editingRow['Center Code']})
                </p>
              </div>
              
              <form onSubmit={handleSaveEdit} style={{ padding: '22px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>OPERATOR FULL NAME</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>OPERATOR CONTACT NUMBER</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>ASSIGNED SHIFT</label>
                  <input
                    type="text"
                    value={editFormData.shift}
                    onChange={(e) => setEditFormData({ ...editFormData, shift: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingRow(null)}
                    style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                  >
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
