'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const errorMessageBox = document.querySelector('.text-error');
const errorMessage = document.querySelector('.text-error__paragraph');

class Workout {
  date;
  id;

  constructor(
    coords,
    distance,
    duration,
    id = (Date.now() + '').slice(-10),
    date = new Date()
  ) {
    this.coords = coords; // {lat, lng}
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.id = id;
    this.date = new Date(date);
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}
    `;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevGain) {
    super(coords, distance, duration);
    this.elevGain = elevGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapEvent;
  #workouts = [];
  #markers = new Map();

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener(
      'click',
      this._moveToPopupOrDeleteWorkout.bind(this)
    );
  }

  _getPosition() {
    navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
      this._errorMsg('Could not get your position', 999999)
    );
  }

  _loadMap(pos) {
    const { latitude } = pos.coords;
    const { longitude } = pos.coords;

    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        form.classList.add('error');
        setTimeout(() => form.classList.remove('error'), 800);
        this._errorMsg('Only positive numbers', 3500);
        return;
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        form.classList.add('error');
        setTimeout(() => form.classList.remove('error'), 800);
        this._errorMsg('Only positive numbers', 3500);
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _errorMsg(msg, time) {
    if (errorMessageBox.classList.contains('text-error--hidden'))
      errorMessageBox.classList.remove('text-error--hidden');
    errorMessage.textContent = `ERROR: ${msg}`;

    setTimeout(() => errorMessageBox.classList.add('text-error--hidden'), time);
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      );

    this.#markers.set(workout.id, marker);

    marker.openPopup();
  }

  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
          <div class="icon-box">
            <ion-icon class="icon-box__icon" name="close-outline"></ion-icon>
          </div>
        </li>
        `;
    }

    if (workout.type === 'cycling') {
      html += `
       <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
        </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevGain}</span>
            <span class="workout__unit">m</span>
          </div>
          <div class="icon-box">
            <ion-icon class="icon-box__icon" name="close-outline"></ion-icon>
          </div>
        </li> 
      `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopupOrDeleteWorkout(e) {
    // if clicked on closeButton
    if (e.target.classList.contains('icon-box__icon')) {
      const closeBtn = e.target.closest('.workout');
      if (!closeBtn) return;

      const id = closeBtn.dataset.id;

      closeBtn.classList.add('hidden--workout');

      this.#workouts = this.#workouts.filter(work => work.id !== id);
      this._setLocalStorage();

      setTimeout(() => closeBtn.remove(), 300);

      const marker = this.#markers.get(id);
      if (marker) {
        marker.remove();
        this.#markers.delete(id);
      }

      return;
    }

    // If clicked on the popup
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, 13, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map(work => {
      if (work.type === 'running') {
        const run = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
        run.id = work.id;
        run.date = new Date(work.date);
        run._setDescription();
        return run;
      }
      if (work.type === 'cycling') {
        const cyc = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevGain
        );
        cyc.id = work.id;
        cyc.date = new Date(work.date);
        cyc._setDescription();
        return cyc;
      }
    });
  }

  _reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
