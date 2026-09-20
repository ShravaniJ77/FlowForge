// ============================================================
// FLOWFORGE — BOARD-AWARE FRONTEND
// ============================================================

const API = "/api";

let currentUser = null;
let currentBoard = null;
let boards = [];
let tasks = [];
let stompClient = null;
let editingTaskId = null;
let draggedTaskId = null;
let draggedCard = null;

// ============================================================
// DOM HELPERS
// ============================================================

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// FLOWFORGE NOTIFICATIONS
// ============================================================

function ensureNotificationContainer() {
    let container = $("#flowforgeNotifications");

    if (!container) {
        container = document.createElement("div");
        container.id = "flowforgeNotifications";

        container.style.position = "fixed";
        container.style.top = "24px";
        container.style.right = "24px";
        container.style.zIndex = "99999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";
        container.style.maxWidth = "380px";

        document.body.appendChild(container);
    }

    return container;
}

function showNotification(message, type = "success") {
    const container = ensureNotificationContainer();

    const notification = document.createElement("div");

    notification.style.padding = "14px 18px";
    notification.style.borderRadius = "14px";
    notification.style.background = "#171717";
    notification.style.color = "#fff";
    notification.style.fontSize = "14px";
    notification.style.lineHeight = "1.4";
    notification.style.boxShadow = "0 12px 35px rgba(0,0,0,0.18)";
    notification.style.border = "1px solid rgba(255,255,255,0.12)";
    notification.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    notification.style.opacity = "0";
    notification.style.transform = "translateY(-8px)";

    if (type === "error") {
        notification.style.borderColor = "rgba(255,90,90,0.45)";
    }

    notification.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="font-size:16px;">
                ${type === "error" ? "!" : "✓"}
            </span>
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    container.appendChild(notification);

    requestAnimationFrame(() => {
        notification.style.opacity = "1";
        notification.style.transform = "translateY(0)";
    });

    setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transform = "translateY(-8px)";

        setTimeout(() => {
            notification.remove();
        }, 250);
    }, 3500);
}

function showError(message) {
    console.error(message);
    showNotification(message || "Something went wrong.", "error");
}

function showSuccess(message) {
    showNotification(message, "success");
}

// ============================================================
// FLOWFORGE CONFIRMATION MODAL
// ============================================================

function showConfirmModal({
    title = "Are you sure?",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false
}) {
    return new Promise((resolve) => {
        const existing = document.getElementById(
            "flowforgeConfirmOverlay"
        );

        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement("div");
        overlay.id = "flowforgeConfirmOverlay";

        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.zIndex = "100000";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.padding = "24px";
        overlay.style.background = "rgba(10,10,10,0.45)";
        overlay.style.backdropFilter = "blur(8px)";

        overlay.innerHTML = `
            <div
                id="flowforgeConfirmDialog"
                style="
                    width:min(460px,100%);
                    background:#fff;
                    border-radius:22px;
                    padding:28px;
                    box-shadow:0 25px 80px rgba(0,0,0,0.25);
                    color:#171717;
                "
            >
                <div style="margin-bottom:20px;">
                    <div
                        style="
                            font-size:20px;
                            font-weight:700;
                            margin-bottom:8px;
                        "
                    >
                        ${escapeHtml(title)}
                    </div>

                    <div
                        style="
                            font-size:14px;
                            line-height:1.6;
                            color:#666;
                        "
                    >
                        ${escapeHtml(message)}
                    </div>
                </div>

                <div
                    style="
                        display:flex;
                        justify-content:flex-end;
                        gap:10px;
                    "
                >
                    <button
                        id="flowforgeConfirmCancel"
                        type="button"
                        style="
                            border:1px solid #ddd;
                            background:#fff;
                            color:#222;
                            border-radius:10px;
                            padding:10px 16px;
                            cursor:pointer;
                        "
                    >
                        ${escapeHtml(cancelText)}
                    </button>

                    <button
                        id="flowforgeConfirmAction"
                        type="button"
                        style="
                            border:none;
                            background:${danger ? "#171717" : "#171717"};
                            color:#fff;
                            border-radius:10px;
                            padding:10px 16px;
                            cursor:pointer;
                        "
                    >
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cleanup = (result) => {
            overlay.remove();
            document.body.classList.remove("modal-open");
            resolve(result);
        };

        document
            .getElementById("flowforgeConfirmCancel")
            ?.addEventListener("click", () => cleanup(false));

        document
            .getElementById("flowforgeConfirmAction")
            ?.addEventListener("click", () => cleanup(true));

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                cleanup(false);
            }
        });

        const escapeHandler = (event) => {
            if (event.key === "Escape") {
                document.removeEventListener(
                    "keydown",
                    escapeHandler
                );
                cleanup(false);
            }
        };

        document.addEventListener(
            "keydown",
            escapeHandler
        );

        document.body.classList.add("modal-open");
    });
}

// ============================================================
// API
// ============================================================

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        throw new Error(
            data?.message ||
            data?.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    setupStaticEvents();

    try {
        await loadCurrentUser();
        await loadBoards();
    } catch (error) {
        console.error(error);

        if (
            window.location.pathname !== "/login.html" &&
            window.location.pathname !== "/register.html"
        ) {
            window.location.href = "/login.html";
        }
    }
});

// ============================================================
// AUTH
// ============================================================

async function loadCurrentUser() {
    currentUser = await apiFetch(`${API}/auth/me`, {
        method: "GET"
    });

    console.log("Logged in as:", currentUser);
}

// ============================================================
// BOARDS
// ============================================================

async function loadBoards() {
    boards = await apiFetch(`${API}/boards`, {
        method: "GET"
    });

    if (!Array.isArray(boards)) {
        boards = [];
    }

    if (boards.length === 0) {
        await createBoard("My Workspace", true);
        return;
    }

    const savedBoardId = Number(
        localStorage.getItem("flowforge_board_id")
    );

    let selectedBoard = boards.find(
        board => Number(board.id) === savedBoardId
    );

    if (!selectedBoard) {
        selectedBoard = boards[0];
    }

    renderBoardSelector();
    await selectBoard(selectedBoard.id);
}

async function createBoard(name, silent = false) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
        if (!silent) {
            showError("Board name cannot be empty.");
        }

        return;
    }

    try {
        const board = await apiFetch(`${API}/boards`, {
            method: "POST",
            body: JSON.stringify({
                name: cleanName
            })
        });

        boards.push(board);

        renderBoardSelector();

        await selectBoard(board.id);

        if (!silent) {
            showSuccess(`"${cleanName}" created.`);
        }
    } catch (error) {
        showError(error.message);
    }
}

async function selectBoard(boardId) {
    const board = boards.find(
        item => Number(item.id) === Number(boardId)
    );

    if (!board) {
        return;
    }

    currentBoard = board;

    localStorage.setItem(
        "flowforge_board_id",
        String(board.id)
    );

    renderBoardSelector();
    updateBoardHeader();
    updateBoardManagementUI();

    disconnectWebSocket();

    $("#membersPanel")?.classList.add("hidden");

    await loadBoardMembers();
    await loadTasks();
    await loadAutoFlow();

    connectWebSocket();
}

// ============================================================
// BOARD UI
// ============================================================

function renderBoardSelector() {
    const select = $("#boardSelect");

    if (!select) {
        return;
    }

    select.innerHTML = boards
        .map(
            board => `
                <option
                    value="${board.id}"
                    ${
                        currentBoard &&
                        Number(currentBoard.id) === Number(board.id)
                            ? "selected"
                            : ""
                    }
                >
                    ${escapeHtml(board.name)}
                </option>
            `
        )
        .join("");
}

function updateBoardHeader() {
    const boardName = $("#boardName");

    if (boardName && currentBoard) {
        boardName.textContent = currentBoard.name;
    }

    const subtitle = $("#heroSubtitle");

    if (subtitle && currentBoard) {
        subtitle.textContent =
            `Plan, prioritize, and move work forward — ${currentBoard.name}.`;
    }
}

// ============================================================
// BOARD MANAGEMENT
// ============================================================

function isCurrentUserBoardOwner() {
    return Boolean(
        currentBoard &&
        currentUser &&
        Number(currentBoard.ownerId) === Number(currentUser.id)
    );
}

function updateBoardManagementUI() {
    const deleteButton = $("#deleteBoardButton");

    if (!deleteButton) {
        return;
    }

    deleteButton.style.display =
        isCurrentUserBoardOwner() ? "" : "none";
}

// ============================================================
// MEMBERS
// ============================================================

async function loadBoardMembers() {
    if (!currentBoard) {
        return;
    }

    try {
        const members = await apiFetch(
            `${API}/boards/${currentBoard.id}/members`,
            {
                method: "GET"
            }
        );

        renderMembers(
            Array.isArray(members) ? members : []
        );
    } catch (error) {
        console.error("Could not load members:", error);
    }
}

function renderMembers(members) {
    const panel = $("#membersPanel");

    if (!panel) {
        return;
    }

    const owner =
        currentBoard &&
        currentUser &&
        Number(currentBoard.ownerId) === Number(currentUser.id);

    panel.innerHTML = `
        <div class="members-inner">

            <div class="members-heading">
                <div class="members-heading-title">
                    <strong>Board members</strong>
                    <span class="member-count">
                        ${members.length}
                    </span>
                </div>
            </div>

            <div class="member-list">

                ${
                    members.length
                        ? members
                              .map(
                                  member => `
                                    <div class="member-row">

                                        <div class="member-avatar">
                                            ${escapeHtml(
                                                member.username
                                                    ?.charAt(0)
                                                    ?.toUpperCase() || "?"
                                            )}
                                        </div>

                                        <div class="member-info">
                                            <strong>
                                                ${escapeHtml(member.username)}
                                            </strong>

                                            <small>
                                                ${escapeHtml(member.email)}
                                            </small>
                                        </div>

                                        <span class="member-role">
                                            ${escapeHtml(member.role)}
                                        </span>

                                        ${
                                            owner &&
                                            member.role !== "OWNER"
                                                ? `
                                                    <button
                                                        type="button"
                                                        class="ghost-button remove-member-button"
                                                        data-member-id="${member.id}"
                                                        data-member-name="${escapeHtml(
                                                            member.username
                                                        )}"
                                                    >
                                                        Remove
                                                    </button>
                                                `
                                                : ""
                                        }

                                    </div>
                                `
                              )
                              .join("")
                        : `
                            <div class="member-note">
                                No members found.
                            </div>
                        `
                }

            </div>

            ${
                owner
                    ? `
                        <div class="invite-area">

                            <div class="invite-title">
                                Add an existing FlowForge user
                            </div>

                            <div class="invite-row">

                                <input
                                    id="inviteEmail"
                                    type="email"
                                    placeholder="user@example.com"
                                >

                                <button
                                    id="inviteButton"
                                    type="button"
                                >
                                    Add
                                </button>

                            </div>

                            <small class="invite-note">
                                The user must already have a FlowForge account.
                            </small>

                        </div>
                    `
                    : `
                        <div class="member-note">
                            Only the board owner can add members.
                        </div>
                    `
            }

        </div>
    `;

    $("#inviteButton")?.addEventListener(
        "click",
        inviteMember
    );

    document
        .querySelectorAll(".remove-member-button")
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const memberId =
                        Number(button.dataset.memberId);

                    const memberName =
                        button.dataset.memberName;

                    await removeMember(
                        memberId,
                        memberName
                    );
                }
            );
        });
}

async function inviteMember() {
    if (!currentBoard) {
        return;
    }

    const input = $("#inviteEmail");

    const email =
        input?.value?.trim()?.toLowerCase();

    if (!email) {
        showError("Enter the user's email.");
        return;
    }

    if (
        currentUser &&
        email === String(currentUser.email).trim().toLowerCase()
    ) {
        showError(
            "You are already a member of this board."
        );
        return;
    }

    try {
        await apiFetch(
            `${API}/boards/${currentBoard.id}/members`,
            {
                method: "POST",
                body: JSON.stringify({
                    email
                })
            }
        );

        input.value = "";

        await loadBoardMembers();

        showSuccess("Member added to the board.");
    } catch (error) {
        showError(error.message);
    }
}

async function removeMember(memberId, memberName) {
    if (!currentBoard) {
        return;
    }

    if (!isCurrentUserBoardOwner()) {
        showError(
            "Only the board owner can remove members."
        );
        return;
    }

    const confirmed = await showConfirmModal({
        title: "Remove member?",
        message:
            `Remove "${memberName}" from this board? ` +
            "They will no longer have access to this board.",
        confirmText: "Remove",
        cancelText: "Cancel",
        danger: true
    });

    if (!confirmed) {
        return;
    }

    try {
        await apiFetch(
            `${API}/boards/${currentBoard.id}/members/${memberId}`,
            {
                method: "DELETE"
            }
        );

        await loadBoardMembers();

        showSuccess(
            `${memberName} was removed from the board.`
        );
    } catch (error) {
        showError(error.message);
    }
}

// ============================================================
// DELETE BOARD
// ============================================================

async function deleteCurrentBoard() {
    if (!currentBoard) {
        return;
    }

    if (!isCurrentUserBoardOwner()) {
        showError(
            "Only the board owner can delete this board."
        );
        return;
    }

    const boardName = currentBoard.name;

    const confirmed = await showConfirmModal({
        title: `Delete "${boardName}"?`,
        message:
            "This action cannot be undone. The board, all of its tasks, " +
            "and member access will be permanently deleted.",
        confirmText: "Delete board",
        cancelText: "Keep board",
        danger: true
    });

    if (!confirmed) {
        return;
    }

    try {
        disconnectWebSocket();

        await apiFetch(
            `${API}/boards/${currentBoard.id}`,
            {
                method: "DELETE"
            }
        );

        boards = boards.filter(
            board =>
                Number(board.id) !==
                Number(currentBoard.id)
        );

        localStorage.removeItem(
            "flowforge_board_id"
        );

        currentBoard = null;
        tasks = [];

        showSuccess(
            `"${boardName}" was deleted.`
        );

        await loadBoards();
    } catch (error) {
        showError(error.message);

        if (currentBoard) {
            connectWebSocket();
        }
    }
}

// ============================================================
// TASKS
// ============================================================

async function loadTasks() {
    if (!currentBoard) {
        return;
    }

    try {
        tasks = await apiFetch(
            `${API}/tasks?boardId=${currentBoard.id}`,
            {
                method: "GET"
            }
        );

        if (!Array.isArray(tasks)) {
            tasks = [];
        }

        renderBoard();
        updateStats();
        populateDependencyDropdown();
    } catch (error) {
        console.error("Could not load tasks:", error);
        showError(error.message);
    }
}

// ============================================================
// BOARD RENDERING
// ============================================================

function renderBoard() {
    const board = $("#board");

    if (!board) {
        return;
    }

    board.innerHTML = `
        <div class="task-column" data-status="TODO">

            <div class="column-header">
                <div>
                    <span class="column-dot"></span>
                    <strong>To Do</strong>
                </div>

                <span
                    class="column-count"
                    id="count-TODO"
                >
                    0
                </span>
            </div>

            <div
                class="task-list"
                data-status="TODO"
            ></div>

        </div>

        <div
            class="task-column"
            data-status="IN_PROGRESS"
        >

            <div class="column-header">
                <div>
                    <span class="column-dot"></span>
                    <strong>In Progress</strong>
                </div>

                <span
                    class="column-count"
                    id="count-IN_PROGRESS"
                >
                    0
                </span>
            </div>

            <div
                class="task-list"
                data-status="IN_PROGRESS"
            ></div>

        </div>

        <div class="task-column" data-status="DONE">

            <div class="column-header">
                <div>
                    <span class="column-dot"></span>
                    <strong>Done</strong>
                </div>

                <span
                    class="column-count"
                    id="count-DONE"
                >
                    0
                </span>
            </div>

            <div
                class="task-list"
                data-status="DONE"
            ></div>

        </div>
    `;

    const columns = {
        TODO: [],
        IN_PROGRESS: [],
        DONE: []
    };

    tasks.forEach(task => {
        if (columns[task.status]) {
            columns[task.status].push(task);
        }
    });

    Object.entries(columns).forEach(
        ([status, columnTasks]) => {
            const list = document.querySelector(
                `.task-list[data-status="${status}"]`
            );

            const count = document.getElementById(
                `count-${status}`
            );

            if (count) {
                count.textContent =
                    columnTasks.length;
            }

            if (!list) {
                return;
            }

            if (columnTasks.length === 0) {
                list.innerHTML = `
                    <div class="empty-column">
                        No tasks here yet
                    </div>
                `;

                return;
            }

            columnTasks.forEach(task => {
                list.appendChild(
                    createTaskCard(task)
                );
            });
        }
    );

    setupDropZones();
}

// ============================================================
// TASK CARD
// ============================================================

function createTaskCard(task) {
    const card = document.createElement("article");

    card.className = "task-card";
    card.draggable = true;
    card.dataset.taskId = String(task.id);

    const dependency = task.dependsOn;

    const blocked =
        dependency &&
        dependency.status !== "DONE";

    const dueInfo =
        getDueInfo(task.dueDate);

    card.innerHTML = `
        <div class="task-card-top">

            <span
                class="
                    priority-badge
                    priority-${String(
                        task.priority || "MEDIUM"
                    ).toLowerCase()}
                "
            >
                ${escapeHtml(
                    task.priority || "MEDIUM"
                )}
            </span>

            <div class="task-actions">

                <button
                    type="button"
                    class="task-icon-button edit-task"
                    title="Edit"
                >
                    ✎
                </button>

                <button
                    type="button"
                    class="task-icon-button delete-task"
                    title="Delete"
                >
                    ×
                </button>

            </div>

        </div>

        <h3 class="task-title">
            ${escapeHtml(task.title)}
        </h3>

        ${
            task.description
                ? `
                    <p class="task-description">
                        ${escapeHtml(task.description)}
                    </p>
                `
                : ""
        }

        ${
            blocked
                ? `
                    <div class="task-blocked">
                        <span>⛓</span>

                        <span>
                            Blocked by:
                            <strong>
                                ${escapeHtml(
                                    dependency.title
                                )}
                            </strong>
                        </span>
                    </div>
                `
                : ""
        }

        <div class="task-meta">

            ${
                task.dueDate
                    ? `
                        <span
                            class="
                                task-due
                                ${dueInfo.className}
                            "
                        >
                            ${dueInfo.label}
                        </span>
                    `
                    : ""
            }

            ${
                task.estimatedMinutes
                    ? `
                        <span class="task-time">
                            ◷ ${task.estimatedMinutes} min
                        </span>
                    `
                    : ""
            }

        </div>
    `;

    // EDIT

    card.querySelector(".edit-task")?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            openEditModal(task.id);
        }
    );

    // DELETE

    card.querySelector(".delete-task")?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            deleteTask(task.id);
        }
    );

    // DRAG START

    card.addEventListener(
        "dragstart",
        event => {
            draggedTaskId = Number(task.id);
            draggedCard = card;

            card.classList.add("dragging");

            event.dataTransfer.effectAllowed = "move";

            event.dataTransfer.setData(
                "text/plain",
                String(task.id)
            );
        }
    );

    // DRAG END

    card.addEventListener(
        "dragend",
        () => {
            draggedTaskId = null;
            draggedCard = null;

            card.classList.remove("dragging");

            document
                .querySelectorAll(
                    ".task-list.drag-over"
                )
                .forEach(list => {
                    list.classList.remove(
                        "drag-over"
                    );
                });
        }
    );

    return card;
}

// ============================================================
// DUE DATE
// ============================================================

function getDueInfo(dateString) {
    if (!dateString) {
        return {
            label: "",
            className: ""
        };
    }

    const due =
        new Date(`${dateString}T00:00:00`);

    const today = new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    const difference =
        Math.ceil(
            (due.getTime() -
                today.getTime()) /
            86400000
        );

    if (difference < 0) {
        return {
            label: "Overdue",
            className: "overdue"
        };
    }

    if (difference === 0) {
        return {
            label: "Due today",
            className: "today"
        };
    }

    if (difference === 1) {
        return {
            label: "Tomorrow",
            className: "soon"
        };
    }

    return {
        label: due.toLocaleDateString(
            undefined,
            {
                month: "short",
                day: "numeric"
            }
        ),
        className:
            difference <= 7
                ? "soon"
                : ""
    };
}

// ============================================================
// DRAG & DROP
// ============================================================

function setupDropZones() {
    document
        .querySelectorAll(".task-list")
        .forEach(list => {

            list.addEventListener(
                "dragenter",
                event => {
                    event.preventDefault();

                    list.classList.add(
                        "drag-over"
                    );
                }
            );

            list.addEventListener(
                "dragover",
                event => {
                    event.preventDefault();

                    event.dataTransfer.dropEffect =
                        "move";

                    list.classList.add(
                        "drag-over"
                    );
                }
            );

            list.addEventListener(
                "dragleave",
                event => {

                    if (
                        event.relatedTarget &&
                        list.contains(
                            event.relatedTarget
                        )
                    ) {
                        return;
                    }

                    list.classList.remove(
                        "drag-over"
                    );
                }
            );

            list.addEventListener(
                "drop",
                async event => {
                    event.preventDefault();
                    event.stopPropagation();

                    list.classList.remove(
                        "drag-over"
                    );

                    let taskId =
                        draggedTaskId;

                    if (!taskId) {
                        const transferId =
                            event.dataTransfer.getData(
                                "text/plain"
                            );

                        if (transferId) {
                            taskId =
                                Number(
                                    transferId
                                );
                        }
                    }

                    if (!taskId) {
                        return;
                    }

                    const status =
                        list.dataset.status;

                    await moveTask(
                        taskId,
                        status
                    );
                }
            );
        });
}

async function moveTask(
    taskId,
    status
) {
    if (!currentBoard) {
        return;
    }

    const task =
        tasks.find(
            item =>
                Number(item.id) ===
                Number(taskId)
        );

    if (!task) {
        return;
    }

    if (task.status === status) {
        return;
    }

    if (
        status === "DONE" &&
        task.dependsOn &&
        task.dependsOn.status !== "DONE"
    ) {
        showError(
            `This task is blocked by "${task.dependsOn.title}".`
        );

        return;
    }

    try {
        await apiFetch(
            `${API}/tasks/${taskId}/move?boardId=${currentBoard.id}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status,
                    position:
                        getNextPosition(
                            status
                        )
                })
            }
        );

        await loadTasks();
        await loadAutoFlow();

    } catch (error) {
        showError(error.message);
    }
}

function getNextPosition(status) {
    const sameColumn =
        tasks.filter(
            task =>
                task.status === status
        );

    return sameColumn.length;
}

// ============================================================
// STATIC EVENTS
// ============================================================

function setupStaticEvents() {

    // TASK MODAL

    $("#newTask")?.addEventListener(
        "click",
        openCreateModal
    );

    $("#close")?.addEventListener(
        "click",
        closeModal
    );

    $("#cancelTaskButton")?.addEventListener(
        "click",
        closeModal
    );

    $("#modal")?.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                $("#modal")
            ) {
                closeModal();
            }
        }
    );

    $("#taskForm")?.addEventListener(
        "submit",
        handleTaskSubmit
    );

    // AUTOFLOW

    $("#autoflowRefresh")?.addEventListener(
        "click",
        loadAutoFlow
    );

    // BOARD SELECT

    $("#boardSelect")?.addEventListener(
        "change",
        async event => {
            await selectBoard(
                Number(
                    event.target.value
                )
            );
        }
    );

    // CREATE BOARD

    $("#createBoardButton")?.addEventListener(
        "click",
        openBoardModal
    );

    // MEMBERS

    $("#membersButton")?.addEventListener(
        "click",
        toggleMembers
    );

    // DELETE BOARD

    $("#deleteBoardButton")?.addEventListener(
        "click",
        deleteCurrentBoard
    );

    // LOGOUT

    $("#logoutButton")?.addEventListener(
        "click",
        logout
    );

    // BOARD MODAL

    $("#closeBoardModal")?.addEventListener(
        "click",
        closeBoardModal
    );

    $("#cancelBoardButton")?.addEventListener(
        "click",
        closeBoardModal
    );

    $("#boardModal")?.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                $("#boardModal")
            ) {
                closeBoardModal();
            }
        }
    );

    $("#boardForm")?.addEventListener(
        "submit",
        handleBoardSubmit
    );

    // ESCAPE KEY

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }

            if (
                $("#modal")?.classList.contains(
                    "active"
                )
            ) {
                closeModal();
                return;
            }

            if (
                $("#boardModal")?.classList.contains(
                    "active"
                )
            ) {
                closeBoardModal();
            }
        }
    );
}

// ============================================================
// BOARD MODAL
// ============================================================

function openBoardModal() {
    const modal =
        $("#boardModal");

    if (!modal) {
        return;
    }

    const input =
        $("#boardNameInput");

    if (input) {
        input.value = "";
    }

    modal.classList.add(
        "active"
    );

    document.body.classList.add(
        "modal-open"
    );

    setTimeout(() => {
        input?.focus();
    }, 50);
}

function closeBoardModal() {
    const modal =
        $("#boardModal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "active"
    );

    document.body.classList.remove(
        "modal-open"
    );
}

async function handleBoardSubmit(
    event
) {
    event.preventDefault();

    const input =
        $("#boardNameInput");

    const name =
        input?.value?.trim();

    if (!name) {
        showError(
            "Board name cannot be empty."
        );

        return;
    }

    closeBoardModal();

    await createBoard(name);
}

// ============================================================
// MEMBERS PANEL
// ============================================================

function toggleMembers() {
    const panel =
        $("#membersPanel");

    if (!panel) {
        return;
    }

    panel.classList.toggle(
        "hidden"
    );
}

// ============================================================
// CREATE TASK
// ============================================================

function openCreateModal() {
    editingTaskId = null;

    const form =
        $("#taskForm");

    if (form) {
        form.reset();
    }

    $("#modalTitle").textContent =
        "Create task";

    $("#submitTask").textContent =
        "Create task";

    $("#editTaskId").value = "";

    $("#status").value =
        "TODO";

    $("#priority").value =
        "MEDIUM";

    populateDependencyDropdown();

    showModal();
}

// ============================================================
// EDIT TASK
// ============================================================

function openEditModal(taskId) {
    const task =
        tasks.find(
            item =>
                Number(item.id) ===
                Number(taskId)
        );

    if (!task) {
        return;
    }

    editingTaskId =
        task.id;

    $("#modalTitle").textContent =
        "Edit task";

    $("#submitTask").textContent =
        "Save changes";

    $("#editTaskId").value =
        task.id;

    $("#title").value =
        task.title || "";

    $("#description").value =
        task.description || "";

    $("#priority").value =
        task.priority || "MEDIUM";

    $("#status").value =
        task.status || "TODO";

    $("#dueDate").value =
        task.dueDate || "";

    $("#estimatedMinutes").value =
        task.estimatedMinutes || "";

    populateDependencyDropdown(
        task.id,
        task.dependsOn?.id
    );

    showModal();
}

// ============================================================
// MODAL HELPERS
// ============================================================

function showModal() {
    const modal =
        $("#modal");

    if (!modal) {
        return;
    }

    modal.classList.add(
        "active"
    );

    document.body.classList.add(
        "modal-open"
    );

    setTimeout(() => {
        $("#title")?.focus();
    }, 50);
}

function closeModal() {
    const modal =
        $("#modal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "active"
    );

    document.body.classList.remove(
        "modal-open"
    );

    editingTaskId = null;
}

// ============================================================
// DEPENDENCIES
// ============================================================

function populateDependencyDropdown(
    excludedTaskId = null,
    selectedDependencyId = null
) {
    const select =
        $("#dependsOn");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            No dependency
        </option>
    `;

    tasks.forEach(task => {

        if (
            excludedTaskId &&
            Number(task.id) ===
                Number(excludedTaskId)
        ) {
            return;
        }

        const option =
            document.createElement(
                "option"
            );

        option.value =
            task.id;

        option.textContent =
            `${task.title} — ${formatStatus(task.status)}`;

        if (
            selectedDependencyId &&
            Number(selectedDependencyId) ===
                Number(task.id)
        ) {
            option.selected = true;
        }

        select.appendChild(
            option
        );
    });
}

function formatStatus(status) {
    if (status === "IN_PROGRESS") {
        return "In Progress";
    }

    if (status === "DONE") {
        return "Done";
    }

    return "To Do";
}

// ============================================================
// CREATE / UPDATE TASK
// ============================================================

async function handleTaskSubmit(
    event
) {
    event.preventDefault();

    if (!currentBoard) {
        showError(
            "Please select a board first."
        );

        return;
    }

    const title =
        $("#title")?.value?.trim();

    if (!title) {
        showError(
            "Task title is required."
        );

        return;
    }

    const dependencyValue =
        $("#dependsOn")?.value;

    const payload = {
        title,

        description:
            $("#description")?.value?.trim() ||
            null,

        priority:
            $("#priority")?.value ||
            "MEDIUM",

        status:
            $("#status")?.value ||
            "TODO",

        dueDate:
            $("#dueDate")?.value ||
            null,

        estimatedMinutes:
            parseInteger(
                $("#estimatedMinutes")?.value
            ),

        dependsOnId:
            dependencyValue
                ? Number(dependencyValue)
                : null
    };

    try {

        if (editingTaskId) {

            await apiFetch(
                `${API}/tasks/${editingTaskId}?boardId=${currentBoard.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify(
                        payload
                    )
                }
            );

        } else {

            await apiFetch(
                `${API}/tasks?boardId=${currentBoard.id}`,
                {
                    method: "POST",
                    body: JSON.stringify(
                        payload
                    )
                }
            );
        }

        closeModal();

        await loadTasks();
        await loadAutoFlow();

        showSuccess(
            editingTaskId
                ? "Task updated."
                : "Task created."
        );

    } catch (error) {
        showError(error.message);
    }
}

function parseInteger(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number <= 0
    ) {
        return null;
    }

    return Math.round(number);
}

// ============================================================
// DELETE TASK
// ============================================================

async function deleteTask(taskId) {
    if (!currentBoard) {
        return;
    }

    const task =
        tasks.find(
            item =>
                Number(item.id) ===
                Number(taskId)
        );

    if (!task) {
        return;
    }

    const confirmed =
        await showConfirmModal({
            title: "Delete task?",
            message:
                `Delete "${task.title}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true
        });

    if (!confirmed) {
        return;
    }

    try {
        await apiFetch(
            `${API}/tasks/${taskId}?boardId=${currentBoard.id}`,
            {
                method: "DELETE"
            }
        );

        await loadTasks();
        await loadAutoFlow();

        showSuccess("Task deleted.");

    } catch (error) {
        showError(error.message);
    }
}

// ============================================================
// STATS
// ============================================================

function updateStats() {
    const total =
        tasks.length;

    const active =
        tasks.filter(
            task =>
                task.status ===
                "IN_PROGRESS"
        ).length;

    const done =
        tasks.filter(
            task =>
                task.status ===
                "DONE"
        ).length;

    if ($("#total")) {
        $("#total").textContent =
            total;
    }

    if ($("#active")) {
        $("#active").textContent =
            active;
    }

    if ($("#done")) {
        $("#done").textContent =
            done;
    }
}

// ============================================================
// AUTOFLOW
// ============================================================

async function loadAutoFlow() {
    if (!currentBoard) {
        return;
    }

    const result =
        $("#autoflowResult");

    if (!result) {
        return;
    }

    result.innerHTML = `
        <div class="autoflow-loading">
            Analyzing your board…
        </div>
    `;

    try {
        const data =
            await apiFetch(
                `${API}/autoflow?boardId=${currentBoard.id}`,
                {
                    method: "GET"
                }
            );

        renderAutoFlow(data);

    } catch (error) {

        console.error(
            "AutoFlow error:",
            error
        );

        result.innerHTML = `
            <div class="autoflow-empty">
                AutoFlow could not analyze this board.
            </div>
        `;
    }
}

function renderAutoFlow(data) {
    const result =
        $("#autoflowResult");

    if (!result) {
        return;
    }

    const recommendation =
        data?.recommendation;

    const ranked =
        Array.isArray(
            data?.rankedTasks
        )
            ? data.rankedTasks
            : [];

    if (!recommendation) {
        result.innerHTML = `
            <div class="autoflow-empty">

                <strong>
                    No next task yet.
                </strong>

                <span>
                    Add an active task to let AutoFlow
                    prioritize your work.
                </span>

            </div>
        `;

        return;
    }

    result.innerHTML = `
        <div class="autoflow-recommendation">

            <div class="autoflow-main">

                <div class="autoflow-eyebrow">
                    NEXT BEST ACTION
                </div>

                <h3>
                    ${escapeHtml(
                        recommendation.title
                    )}
                </h3>

                <div class="autoflow-score">
                    Score ${recommendation.score}
                </div>

            </div>

            <button
                id="ffAutoFlowOpenTask"
                class="ff-autoflow-button"
                type="button"
            >
                Open task
            </button>

        </div>

        <div class="autoflow-reasons">

            ${
                (recommendation.reasons || [])
                    .map(
                        reason => `
                            <span class="autoflow-reason">
                                ${escapeHtml(reason)}
                            </span>
                        `
                    )
                    .join("")
            }

        </div>

        ${
            ranked.length > 1
                ? `
                    <div class="autoflow-ranking">

                        <div class="autoflow-ranking-title">
                            Other priorities
                        </div>

                        ${
                            ranked
                                .slice(1, 4)
                                .map(
                                    (item, index) => `
                                        <div
                                            class="autoflow-ranked-item"
                                            data-task-id="${item.id}"
                                        >

                                            <span>
                                                ${index + 2}
                                            </span>

                                            <strong>
                                                ${escapeHtml(
                                                    item.title
                                                )}
                                            </strong>

                                            <small>
                                                ${item.score}
                                            </small>

                                        </div>
                                    `
                                )
                                .join("")
                        }

                    </div>
                `
                : ""
        }
    `;

    $("#ffAutoFlowOpenTask")?.addEventListener(
        "click",
        () => {
            openEditModal(
                recommendation.id
            );
        }
    );

    document
        .querySelectorAll(
            ".autoflow-ranked-item"
        )
        .forEach(item => {

            item.addEventListener(
                "click",
                () => {
                    openEditModal(
                        Number(
                            item.dataset.taskId
                        )
                    );
                }
            );
        });
}

// ============================================================
// WEBSOCKET
// ============================================================

function connectWebSocket() {

    if (!currentBoard) {
        return;
    }

    if (typeof StompJs === "undefined") {
        console.warn("STOMP library is not available.");
        return;
    }

    if (typeof SockJS === "undefined") {
        console.warn("SockJS library is not available.");
        return;
    }

    try {

        const socketFactory = () => new SockJS("/ws");

        stompClient = new StompJs.Client({
            webSocketFactory: socketFactory,
            reconnectDelay: 5000,
            debug: () => {}
        });

        stompClient.onConnect = () => {

            stompClient.subscribe(
                "/user/queue/tasks",
                message => {
                    handleRealtimeMessage(message);
                }
            );

            stompClient.subscribe(
                "/user/queue/boards",
                message => {
                    handleBoardRealtimeMessage(message);
                }
            );
        };

        stompClient.onStompError = frame => {
            console.warn(
                "FlowForge STOMP error:",
                frame.headers["message"] || "Unknown error"
            );
        };

        stompClient.onWebSocketError = error => {
            console.warn(
                "FlowForge WebSocket error:",
                error
            );
        };

        stompClient.activate();

    } catch (error) {

        console.warn(
            "Could not start WebSocket:",
            error
        );
    }
}

function handleRealtimeMessage(message) {
    try {
        const payload = JSON.parse(message.body);

        if (!currentBoard) {
            return;
        }

        if (
            Number(payload.boardId) !==
            Number(currentBoard.id)
        ) {
            return;
        }

        console.log(
            "FlowForge realtime event:",
            payload.type
        );

        if (
            payload.type === "CREATED" &&
            payload.task
        ) {
            const exists = tasks.some(
                task =>
                    Number(task.id) ===
                    Number(payload.task.id)
            );

            if (!exists) {
                tasks.push(payload.task);
            }
        }

        if (
            (
                payload.type === "UPDATED" ||
                payload.type === "MOVED"
            ) &&
            payload.task
        ) {
            const index = tasks.findIndex(
                task =>
                    Number(task.id) ===
                    Number(payload.task.id)
            );

            if (index !== -1) {
                tasks[index] = payload.task;
            } else {
                tasks.push(payload.task);
            }
        }

        if (
            payload.type === "DELETED" &&
            payload.taskId != null
        ) {
            tasks = tasks.filter(
                task =>
                    Number(task.id) !==
                    Number(payload.taskId)
            );
        }

        
        renderBoard();
updateStats();
populateDependencyDropdown();
loadAutoFlow();

    } catch (error) {
        console.warn(
            "Invalid realtime message:",
            error
        );
    }
}
async function handleBoardRealtimeMessage(message) {

    try {

        const payload = JSON.parse(message.body);

        // BOARD ADDED
        if (payload.type === "BOARD_ADDED") {

            

            await loadBoards();

            showNotification(
                `You were added to "${payload.boardName}".`,
                "success"
            );

            return;
        }

        // For removal/deletion, there must be a current board
        if (!currentBoard) {
            return;
        }

        if (
            Number(payload.boardId) !==
            Number(currentBoard.id)
        ) {
            return;
        }

        // MEMBER REMOVED
        if (payload.type === "MEMBER_REMOVED") {

            const removedBoardName =
                payload.boardName || currentBoard.name;

            disconnectWebSocket();

            boards = boards.filter(
                board =>
                    Number(board.id) !==
                    Number(payload.boardId)
            );

            localStorage.removeItem(
                "flowforge_board_id"
            );

            currentBoard = null;
            tasks = [];

            showNotification(
                `You were removed from "${removedBoardName}".`,
                "error"
            );

            await loadBoards();

            return;
        }

        // BOARD DELETED
        if (payload.type === "BOARD_DELETED") {

            const deletedBoardName =
                payload.boardName || currentBoard.name;

            disconnectWebSocket();

            boards = boards.filter(
                board =>
                    Number(board.id) !==
                    Number(payload.boardId)
            );

            localStorage.removeItem(
                "flowforge_board_id"
            );

            currentBoard = null;
            tasks = [];

            showNotification(
                `"${deletedBoardName}" was deleted by the board owner.`,
                "error"
            );

            // Reload the fresh board list
            await loadBoards();

            // Refresh the dropdown
            renderBoardSelector();

            return;
        }

    } catch (error) {

        console.warn(
            "Invalid board realtime message:",
            error
        );
    }
}

function disconnectWebSocket() {
    if (!stompClient) {
        return;
    }

    try {
        if (
            typeof stompClient.deactivate ===
            "function"
        ) {
            stompClient.deactivate();
        } else if (
            typeof stompClient.disconnect ===
            "function"
        ) {
            stompClient.disconnect();
        }
    } catch (error) {
        console.warn(
            "WebSocket disconnect error:",
            error
        );
    }

    stompClient = null;
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {
    try {

        await apiFetch(
            `${API}/auth/logout`,
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    } finally {

        disconnectWebSocket();

        localStorage.removeItem(
            "flowforge_board_id"
        );

        window.location.href =
            "/login.html";
    }
}

// ============================================================
// OPTIONAL GLOBAL ACCESS
// ============================================================

window.FlowForge = {

    getCurrentUser: () =>
        currentUser,

    getCurrentBoard: () =>
        currentBoard,

    getTasks: () =>
        tasks,

    reload: async () => {
        await loadTasks();
        await loadAutoFlow();
    }

};