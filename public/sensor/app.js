const $ = (selector) => document.querySelector(selector);
const components = {
  wind: ['ATMOSPHERIC SENSING', 'Read the wind.', 'An elevated sensor head would measure local wind speed and direction. Its position helps separate the measurement from disturbances around the base.', 'Speed (m/s) · direction (°)'],
  weather: ['ENVIRONMENTAL CONTEXT', 'Put the air in context.', 'A radiation-shielded weather pod would measure ambient temperature, pressure and humidity. The shield helps limit heating from direct sunlight.', 'Temperature (°C) · pressure (Pa) · RH (%)'],
  dust: ['PARTICLE SENSING', 'See what is in the air.', 'A particle-sensing module could estimate local dust concentration and particle size distribution. Martian pressure and dust properties would require dedicated calibration.', 'Concentration (µg/m³) · particle size (µm)'],
  camera: ['SITE AWARENESS + LINK', 'Give every reading a place.', 'A camera adds visual context, while an antenna provides a proposed radio link. A local site reference would locate each station; Earth GPS would not provide positioning on Mars.', 'Images · station ID · local coordinates'],
  power: ['ENERGY + MOBILITY', 'Move. Deploy. Keep observing.', 'Fold-out solar wings would recharge an onboard battery. The electronics bay stores readings, while wheels and stabilising legs support relocation and deployment.', 'Battery state (%) · panel power (W) · system health'],
};
let model;
let selectedComponent = 'wind';
let deployment = 1;
const poseDescriptions = {
  deployed: 'MarsWindNet concept station with extended sensor mast, two solar wings and stabilising legs',
  folded: 'MarsWindNet concept station folded into a compact wheeled transport configuration',
};
document.querySelectorAll('[data-pose]').forEach((button) => button.addEventListener('click', () => {
  const pose = button.dataset.pose;
  document.querySelectorAll('[data-pose]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  $('#hero-product').src = `./assets/${pose}.png`;
  $('#hero-product').alt = poseDescriptions[pose];
  $('#hero-product').classList.toggle('folded', pose === 'folded');
  document.querySelectorAll('.callout').forEach(el => el.hidden = pose === 'folded');
}));
document.querySelectorAll('[data-component]').forEach((button) => button.addEventListener('click', () => {
  selectedComponent = button.dataset.component;
  document.querySelectorAll('[data-component]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  ['#component-type', '#component-title', '#component-description', '#component-output'].forEach((selector, i) => $(selector).textContent = components[selectedComponent][i]);
  model?.highlight(selectedComponent);
}));
function setDeployment(value) {
  deployment = Number(value) / 100;
  $('#deploy-slider').value = String(value);
  $('#deploy-value').textContent = `${value}%`;
  model?.deploy(deployment);
}
$('#deploy-slider').addEventListener('input', e => setDeployment(e.target.value));
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-step]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  const step = button.dataset.step;
  setDeployment(step);
  const states = {
    '0': ['01 / POSITION THE STATION', 'folded', 'A compact form for moving between observation sites.', 'Sensor station folded for transport'],
    '50': ['02 / UNFOLD & STABILISE', 'sequence', 'The concept sequence: from folded unit to deployed station.', 'Five-stage reference illustration of the proposed deployment sequence'],
    '100': ['03 / RAISE & OBSERVE', 'deployed', 'A wider footprint. An elevated point of view.', 'Sensor station in its deployed configuration'],
  };
  const [label, file, caption, alt] = states[step];
  $('#deployment-stage').textContent = label;
  $('#deployment-image').src = `./assets/${file}.png`;
  $('#deployment-image').alt = alt;
  $('#deployment-caption').textContent = caption;
}));
$('#reset-view').addEventListener('click', () => model?.reset());
$('#rotate-left').addEventListener('click', () => model?.rotate(-0.3));
$('#rotate-right').addEventListener('click', () => model?.rotate(0.3));
const observer = new IntersectionObserver(async ([entry]) => {
  if (!entry.isIntersecting) return;
  observer.disconnect();
  try {
    const { createStation } = await import('./station.js');
    model = createStation($('#model-view'));
    model.deploy(deployment);
    model.highlight(selectedComponent);
    $('#model-view').classList.add('ready');
  } catch (error) {
    $('#model-status').textContent = '3D is unavailable in this browser. Explore the reference image and component descriptions.';
    $('#gesture-hint').textContent = 'Concept reference image';
    ['#reset-view','#rotate-left','#rotate-right','#deploy-slider'].forEach(selector => $(selector).disabled = true);
    console.warn('Sensor model unavailable:', error.message);
  }
}, { rootMargin: '300px' });
observer.observe($('#explorer'));
