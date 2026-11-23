    // 1. Disable Right-Click (Context Menu)
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });

    // 2. Disable standard DevTools and View Source keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (
        e.key === 'F12' || // F12
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) || // Ctrl+Shift+J
        (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) || // Ctrl+Shift+C
        (e.ctrlKey && (e.key === 'U' || e.key === 'u')) || // Ctrl+U (View Source)
        (e.ctrlKey && (e.key === 'S' || e.key === 's'))    // Ctrl+S (Save Page)
      ) {
        e.preventDefault();
        return false;
      }
    });

    // 3. Prevent dragging images to new tabs to see their source
    document.addEventListener('dragstart', function(e) {
      if (e.target.nodeName === 'IMG') {
          e.preventDefault();
      }
    });
// Trạng thái lưu trữ các ID bài Test đang được chọn
window.selectedTestIds = [];

// Hàm chọn/bỏ chọn 1 bài Test
window.toggleTestSelection = function(testId, isChecked) {
    if (isChecked) {
        if (!window.selectedTestIds.includes(testId)) window.selectedTestIds.push(testId);
    } else {
        window.selectedTestIds = window.selectedTestIds.filter(id => id !== testId);
    }
    window.updateBulkActionBar();
};

// Hàm "Chọn tất cả" trên trang hiện tại
window.toggleSelectAllTests = function(checkbox) {
    const checkboxes = document.querySelectorAll('.test-select-cb');
    window.selectedTestIds = []; // Xóa danh sách cũ
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        if (checkbox.checked) window.selectedTestIds.push(cb.value);
    });
    window.updateBulkActionBar();
};

// Hàm hiển thị/ẩn thanh Bulk Action dựa vào số lượng thẻ được chọn
window.updateBulkActionBar = function() {
    const bar = document.getElementById('bulk-action-bar');
    const countLabel = document.getElementById('selected-test-count');
    const selectAllCb = document.getElementById('select-all-tests');
    
    if (window.selectedTestIds.length > 0) {
        bar.classList.remove('hidden');
        bar.classList.add('flex');
        countLabel.textContent = window.selectedTestIds.length;
        
        // Tự động tick "Select All" nếu tất cả checkbox trên màn hình đều đang được tick
        const totalVisible = document.querySelectorAll('.test-select-cb').length;
        selectAllCb.checked = (totalVisible > 0 && window.selectedTestIds.length === totalVisible);
    } else {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        selectAllCb.checked = false;
    }
};

// === CÁC CHỨC NĂNG THỰC THI (BULK ACTIONS) ===

// 1. Xóa hàng loạt
window.bulkDeleteTests = function() {
    if (window.selectedTestIds.length === 0) return;
    
    window.showConfirm("Xóa Hàng Loạt", `Bạn có chắc chắn muốn xóa vĩnh viễn <b>${window.selectedTestIds.length}</b> bài test đã chọn? Hành động này không thể hoàn tác!`, async () => {
        try {
            for (let id of window.selectedTestIds) {
                await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('tests'), id));
            }
            window.selectedTestIds = [];
            window.updateBulkActionBar();
            if (typeof window.showToast === 'function') window.showToast("Thành công", "Đã xóa các bài test được chọn.");
            
            // Render lại danh sách test
            if (typeof renderTestBank === 'function') renderTestBank();
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast("Lỗi", "Không thể xóa một số bài test.", "error");
        }
    });
};

// 2. Đổi trạng thái hàng loạt
window.bulkChangeStatus = function() {
    if (window.selectedTestIds.length === 0) return;
    
    const html = `
        <label class="block text-sm font-bold text-slate-700 mb-2">Chọn trạng thái mới cho ${window.selectedTestIds.length} bài test:</label>
        <select id="bulk-status-select" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold bg-white shadow-sm cursor-pointer">
            <option value="not_started">🔴 Not Started</option>
            <option value="in_progress">🟡 In Progress</option>
            <option value="review_ready">🟣 Ready for Review</option>
            <option value="approved">🟢 Approved</option>
        </select>
    `;
    
    window.showConfirm("Cập nhật Trạng thái", html, async () => {
        const newStatus = document.getElementById('bulk-status-select').value;
        try {
            // Dùng { merge: true } để chỉ cập nhật trường status, giữ nguyên các dữ liệu khác
            for (let id of window.selectedTestIds) {
                const testRef = window.fsDoc(window.db, window.fPath('tests'), id);
                await window.fsSetDoc(testRef, { status: newStatus }, { merge: true });
            }
            window.selectedTestIds = [];
            window.updateBulkActionBar();
            if (typeof window.showToast === 'function') window.showToast("Thành công", "Đã cập nhật trạng thái hàng loạt.");
            
            if (typeof renderTestBank === 'function') renderTestBank();
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast("Lỗi", "Không thể cập nhật trạng thái.", "error");
        }
    });
};
