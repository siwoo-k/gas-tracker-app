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

  centerOnUser();
  initAutoComplete();
}

function centerOnUser() {
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

function initAutoComplete() {
  const input = document.getElementById('search-input');
  let autoComplete = new google.maps.places.Autocomplete(input);
  const searchBar = document.getElementById('search-bar')

  input.addEventListener('input', () => {
    const pacContainer = document.querySelector('.pac-container');
    const address = document.getElementById('search-input').value.trim();
    if (address.length === 1 && isAlphanumeric(address)) {
      setTimeout(() => {
        searchBar.style.borderRadius = "20px 20px 0 0";
      }, 150);
    } else if (address) {
      setTimeout(() => {
        if (pacContainer && pacContainer.style.display !== 'none') {
          searchBar.style.borderRadius = "20px 20px 0 0";
        } else {
          searchBar.style.borderRadius = "20px";
        }
      }, 300);
    } else {
      searchBar.style.borderRadius = "20px";
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

  autoComplete.addListener('place_changed', () => {
    const address = document.getElementById('search-input').value.trim();
    
    geocoder.geocode({ 'address': address }, function(results, status) {
      if (status === 'OK') {
        const location = results[0].geometry.location;
        map.setCenter(location);
      } else {
        alert('Geocoder was unsucessful: ' + status);
      }
    });
  });
}

function isAlphanumeric(str) {
  const regex = /^[a-zA-Z0-9]+$/;
  return regex.test(str);
}

initMap();