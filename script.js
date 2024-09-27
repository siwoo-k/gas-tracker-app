let map, places, geocoder, infoWindow, distanceMatrix; // important shared variables
let zoom = 16; // default zoom level
let daily = 0;

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Place  } = await google.maps.importLibrary("places");

  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();
  distanceMatrix = new google.maps.DistanceMatrixService();
  places = Place;

  map = new Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: zoom,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM 
    },
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [{ visibility: "off" }], // turns off pins on map
      },
      {
        featureType: "transit",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
    ],
  });

  document.getElementById("search-count").innerText = `${daily}`;

  google.maps.event.addListener(map, "dragend", function() {
    document.getElementById('show-gas-button').style.display = "flex";
  });

  centerUser();
  initSearch();
}

function centerUser() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        let pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.panTo({ lat: pos.lat, lng: pos.lng });
      },
      function(error) {
        alert("Allow location permission to find your address: ", error);
      }
    );
  }
}

async function initSearch() {
  const input = document.getElementById('search-input');
  let autoComplete = new google.maps.places.Autocomplete(input);
  const searchBar = document.getElementById('search-bar');
  const closeButton = document.getElementById('close-button');
  const searchButton = document.getElementById('search-button');
  const showGasButton = document.getElementById('show-gas-button');
  searchButton.disabled = true;

  input.addEventListener('input', () => {
    document.getElementById('show-gas-button').style.display = "none";
    const pacContainer = document.querySelector('.pac-container');
    const address = document.getElementById('search-input').value.trim();

    if (address.length === 1 && isAlphanumeric(address)) {
      setTimeout(() => {
        searchBar.style.borderRadius = "20px 20px 0 0";
      }, 150);
      closeButton.style.display = "inline-block";
      searchButton.classList.add('active');
      searchButton.disabled = false;
    } else if (address) {
      setTimeout(() => {
        if (pacContainer && pacContainer.style.display !== 'none') {
          searchBar.style.borderRadius = "20px 20px 0 0";
        } else {
          searchBar.style.borderRadius = "20px";
        }
      }, 300);
      closeButton.style.display = "inline-block";
      searchButton.classList.add('active');
      searchButton.disabled = false;
    } else {
      searchBar.style.borderRadius = "20px";
      closeButton.style.display = "none";
      searchButton.classList.remove('active');
      searchButton.disabled = true;
    }
  });

  input.addEventListener('blur', () => {
    searchBar.style.borderRadius = "20px";
  });

  input.addEventListener('focus', () => {
    const pacContainer = document.querySelector('.pac-container');
    const address = document.getElementById('search-input').value.trim();
    if (address) {
      setTimeout(() => {
        if (pacContainer && pacContainer.style.display !== 'none') {
          searchBar.style.borderRadius = "20px 20px 0 0";
        }
      }, 0);
    }
  });

  input.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      document.activeElement.blur();
      getGeocode();
    }
  });

  autoComplete.addListener('place_changed', () => {
    getGeocode();
  });

  closeButton.addEventListener('click', function() {
    input.value = "";
    closeButton.style.display = "none";
    searchButton.classList.remove('active');
    searchButton.disabled = true;
    document.getElementById('show-gas-button').style.display = "none";
  });

  searchButton.addEventListener('click', function() {
    getGeocode();
  });

  showGasButton.addEventListener('click', function() {
    showGasButton.style.display = "none";
    showGasStations(map.getCenter()); // skip geocode process
  })
}

function isAlphanumeric(str) {
  const regex = /^[a-zA-Z0-9]+$/;
  return regex.test(str);
}

function addSearchCount() {
  daily += 1;
  document.getElementById("search-count").innerText = `${daily}`;
}

function getGeocode() {
  const address = document.getElementById('search-input').value.trim();
  geocoder.geocode({ 'address': address }, function(results, status) {
    if (status === 'OK') {
      const location = results[0].geometry.location;
      map.setCenter(location);
      map.panTo(location);
      addSearchCount();
      document.getElementById('search-bar').style.borderRadius = "20px";
      document.getElementById('show-gas-button').style.display = "none";
      showGasStations(location); // call show gas here
    } else {
      alert('No address found! Try again');
    }
  });
}

async function showGasStations(location) {
  alert('yes');
  const request = {
    fields: ["displayName", 
             "location", 
             "formattedAddress", 
             "fuelOptions"],
    locationRestriction: {
      center: location,
      radius: size,
    },
    includedPrimaryTypes: ["gas_station"],
    maxResultCount: maxResult,
    rankPreference: rankPreference.DISTANCE,
    language: "en-US",
  };
}

function toggleWindowSizing() {
  const mapWindow = document.getElementById('map');
  const gasPage = document.getElementById('gas-page');

  if (mapWindow.classList.contains('collapse')) {
    mapWindow.classList.remove('collapse');
    gasPage.classList.remove('show');
  } else {
    mapWindow.classList.add('collapse');
    gasPage.classList.add('show');
  }
}

initMap();