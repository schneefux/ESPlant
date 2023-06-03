const debug = window.location.hostname === "localhost";

const app = document.querySelector(".app");

/* business logic */
async function submitCredentials(ssid, password) {
  const credentials = new URLSearchParams();
  credentials.append("ssid", ssid);
  credentials.append("password", password);

  const res = await fetch(`/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: credentials,
  });

  if (!res.ok) {
    return {
      error: "Error submitting credentials: " + res.statusText,
    };
  } else {
    return {
      error: null,
    };
  }
}

async function submitMQTTConfig(config) {
  const encodedConfig = new URLSearchParams(config);

  const res = await fetch(`/mqttSetup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodedConfig,
  });

  if (!res.ok) {
    return {
      error: "Error submitting MQTT configuration: " + res.statusText,
    };
  } else {
    return {
      error: null,
    };
  }
}

async function getNearbyNetworks() {
  const res = await fetch("/networks");
  if (!res.ok) {
    throw new Error("Error scanning networks: " + res.statusText);
  }
  return await res.json();
}

/* fetch loading state indicator */
const fetch = new Proxy(window.fetch, {
  apply: async (target, thisArg, args) => {
    startLoading();
    const res = await target.apply(thisArg, args);
    stopLoading();
    return res;
  },
});

function startLoading() {
  app.classList.add("app--loading");
}

function stopLoading() {
  app.classList.remove("app--loading");
}

/* navigation state event bus */
const pageNavigationListeners = [];
function hookOnPageNavigate(callback) {
  pageNavigationListeners.push(callback);
}

function onPageNavigate(page) {
  pageNavigationListeners.forEach((callback) => callback(page));
}

/* navigation API */
function gotoPage(page) {
  app.setAttribute("data-current", page);
  onPageNavigate(page);
}

function previousPage() {
  const currentPage = parseInt(app.getAttribute("data-current"));
  gotoPage(currentPage - 1);
}

function nextPage() {
  const currentPage = parseInt(app.getAttribute("data-current"));
  gotoPage(currentPage + 1);
}

/* stepper component */
document.getElementById("stepper").addEventListener("click", (e) => {
  const targetPage = parseInt(e.target.getAttribute("data-step"));
  if (targetPage && targetPage < getCurrentPage()) {
    gotoPage(targetPage);
  }
});

function updateStepper(currentPage) {
  document
    .querySelectorAll("[data-step]")
    .forEach((el) => el.classList.remove("active", "done"));
  for (let page = 1; page < currentPage; page++) {
    document.querySelector(`[data-step="${page}"]`).classList.add("done");
  }
  document
    .querySelector(`[data-step="${currentPage}"]`)
    ?.classList.add("active");

  document
    .querySelectorAll("[data-page]")
    .forEach((el) => (el.style.display = "none"));
  const pageEl = document.querySelector(`[data-page="${currentPage}"]`);
  if (pageEl) {
    pageEl.style.display = "";
  }
}
hookOnPageNavigate(updateStepper);

/* navigation buttons */
document.querySelectorAll(".back").forEach((el) => {
  el.addEventListener("click", (e) => {
    previousPage();
  });
});

document.getElementById("status-form").addEventListener("submit", (e) => {
  e.preventDefault();
  nextPage();
});

document.getElementById("networks-form").addEventListener("submit", (e) => {
  e.preventDefault();
  nextPage();
});

document
  .getElementById("credentials-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const ssid = e.target.ssid.value;
    const password = e.target.password.value;

    const errorEl = document.getElementById("credentials-error");
    errorEl.style.display = "none";

    const res = await submitCredentials(ssid, password);
    if (res.error) {
      errorEl.innerText = e.error;
      errorEl.style.display = "";
      return;
    }

    nextPage();
  });

document.getElementById("mqtt-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const server = e.target.server.value;
  const port = e.target.port.value;
  const user = e.target.user.value;
  const password = e.target.password.value;
  const topic = e.target.topic.value;
  const clientId = e.target.clientid.value;
  const config = {
    server,
    port,
    user,
    password,
    topic,
    clientId,
  };

  const errorEl = document.getElementById("mqtt-error");
  errorEl.style.display = "none";

  if (server == "") {
    nextPage();
    return;
  }

  const res = await submitMQTTConfig(config);
  if (res.error) {
    errorEl.innerText = e.error;
    errorEl.style.display = "";
    return;
  }

  nextPage();
});

/* password input toggle */
for (const node of document.getElementsByClassName("password-visibility")) {
  node.addEventListener("click", (e) => {
    const target = e.target.getAttribute("data-target");
    const passwordInput = document.getElementById(target);
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      e.target.innerHTML = "&#128064;";
    } else {
      passwordInput.type = "password";
      e.target.innerHTML = "&#128065;";
    }
  });
}

/* wifi network list */
function renderNetwork(network) {
  const template = document.getElementById("wifi-template");
  const node = template.content.cloneNode(true);

  const button = node.querySelector(".button");
  button.value = network.ssid;
  button.addEventListener(
    "click",
    () => (document.getElementById("ssid").value = network.ssid)
  );

  node.querySelector(".ssid").textContent = network.ssid;
  if (network.secure == 7) {
    node.querySelector(".secure").style.display = "none";
  }

  // RSSI is between -50 (strongest) and -100 (weakest)
  const rssiFraction = (network.rssi + 100) / 50;
  node.querySelectorAll(".wave").forEach((el, index) => {
    if (index + 1 > rssiFraction * 4) {
      el.classList.add("wifi__wave--active");
    }
  });

  return node;
}

function renderNetworkList(nodes) {
  const networksListEl = document.getElementById("networks-list");
  networksListEl.innerHTML = "";
  nodes.forEach((node) => networksListEl.appendChild(node));
}

document.getElementById("refresh-networks").addEventListener("click", (e) => {
  updateNetworksList();
});

async function updateNetworksList() {
  const errorEl = document.getElementById("networks-error");
  errorEl.style.display = "none";
  try {
    const res = await getNearbyNetworks();
    renderNetworkList(res.map(renderNetwork));
  } catch (e) {
    errorEl.innerText = e.message;
    errorEl.style.display = "";
  }
}
hookOnPageNavigate((page) => {
  if (page == 2) {
    updateNetworksList();
  }
});

// fetch /isConnected every 3 seconds
setInterval(async () => {
  const res = await fetch("/isConnected");
  const data = await res.json();
  console.log(data);
  if (data === 1) {
    // redirect to home page
    window.location.href = "/";
  }
}, 3000);