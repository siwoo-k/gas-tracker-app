let map, places, geocoder, infoWindow, distanceMatrix; // important shared variables
let zoom = 16; // default zoom level
let daily = 0;
let markers = [], markernum = 1, prevMarker;

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

  // disable scrolling page when mouse is on map or gas list
  const nonScrollable = document.querySelectorAll('.non-scrollable');
  nonScrollable.forEach(div => {
    div.addEventListener('mouseenter', toggleBodyScroll); 
    div.addEventListener('mouseleave', toggleBodyScroll); 
  });

  centerIrvine();
  initSearch();
}

async function initCookies() {
  if (document.cookie.includes("gastracker") || localStorage.getItem('cookies_enabled')) {
    return;
  }
  const cookieWindow = document.getElementById('cookie-window');
  cookieWindow.style.display = "inline-block";

  const cookieButton = document.querySelectorAll('.cookie-button');
  cookieButton.forEach((button) => {
    button.addEventListener('click', function() {
      cookieWindow.style.display = "none";

      if (button.id == "accept-cookie") {
        document.cookie = "cookieBy= gastracker; max-age" + 60 * 60 * 24 * 30; // cookie for 1 month
        // remove consent window on second visit (if button is pressed)
        localStorage.setItem('cookies_enabled', '1');
      } else {
        localStorage.setItem('cookies_enabled', '0');
      }
    });
    
  });
}

async function toggleBodyScroll() {
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = 'auto';
  } else {
    document.body.style.overflow = 'hidden';
  }
}

function centerIrvine() {
  let pos = {
    lat: 33.65374485149536,
    lng: -117.8364730390892
  };
  map.panTo({ lat: pos.lat, lng: pos.lng});
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
        createCenterMarker(pos);
      },
      function(error) {
        alert("Allow location permission to find your address: ", error);
      }
    );
  }
}

function createCenterMarker(pos) {
  const marker = new google.maps.Marker({
    map: map,
    position: pos,
    icon: {
      url: `images/icons/user.png`,
      scaledSize: new google.maps.Size(32, 32),
    }
  });
  markers.push(marker);
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
    map.setCenter(map.getCenter()); // manually set map center
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
  clearItems();
  createCenterMarker(location);
  const request = {
    fields: ["displayName", 
             "location", 
             "formattedAddress", 
             "fuelOptions"],
    locationRestriction: {
      center: location,
      radius: 8046.72, // 5 mile
    },
    includedPrimaryTypes: ["gas_station"],
    maxResultCount: 10,
    language: "en-US",
  };

  try {
    const response = await places.searchNearby(request);
    const gasResults = new Map();

    response.places.forEach(place => {
      if (place.fuelOptions && place.fuelOptions.fuelPrices) {
        const address = place.formattedAddress;
        if (!gasResults.has(address)) {
          gasResults.set(address, place);
        }
      }
    });

    for (let place of gasResults.values()) {
      await appendResults(place);
    }
    toggleWindowOn();
  } catch (error) {
    alert('Places service was unsuccessful: ' + error.message);
  }
}

async function appendResults(place) {
  const resultsWindow = document.getElementById('gas-list');
  const numID = resultsWindow.getElementsByTagName('li').length + 1; // item number inside gas list
  const gasItem = document.createElement('li');
  gasItem.classList.add('gas-item');

  const fuelData = new Map();
  let fuelDataArray = [];
  let frontPrice = null;

  place.fuelOptions.fuelPrices.forEach(fuelPrice => {
    const price = (fuelPrice.price.units - 0.01 + fuelPrice.price.nanos / 1e9).toFixed(2);
    let fuelType = fuelPrice.type;
    
    if (fuelPrice.type === 'REGULAR_UNLEADED') {
      fuelType = 'REGULAR';
      frontPrice = price;
    }
    
    // for reference
    fuelData.set(fuelType, {
      price: price,
      currency: fuelPrice.price.currencyCode
    });

    fuelDataArray.push(`<div>${fuelType}<br>&#36;<span class="fuel-price">${price}</span> ${fuelPrice.price.currencyCode}</div>`);
  });

  let fuelDataHTML = fuelDataArray.reverse().join('');

  let distance = await getDistanceInfo(place);

  // check if within 5 miles
  if (distance !== undefined) {
    if (parseFloat(distance) > 5 * 1.15) {
      return;
    }
  }

  // <span style="display: inline-block; margin-left: 5px;" class="front-price">
  //   &#36;${frontPrice}
  // </span>

  gasItem.innerHTML = ` 
                        <span style="font-weight: 500; font-size: 18px;">
                          <span class="item-number">${numID}&#46;</span>
                          ${place.displayName}
                        </span>
                        <br>
                        <span class="item-address">
                          ${place.formattedAddress.split(',')[0]}
                        </span>
                        <span style="font-size: 14px;">
                        &#126; ${distance} away
                        </span>
                        <div class="item-bar">
                          <div class="item-price">
                            ${fuelDataHTML}
                          </div>
                        </div>
                      `;

  gasItem.querySelector('.item-address').addEventListener('click', function(event) {
    event.stopPropagation(); // prevent parent event to activate
    navigator.clipboard.writeText(place.formattedAddress)
      .then(() => {
        alert("Copied to clipboard!");
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  });

  gasItem.dataset.latitude = place.location.lat();
  gasItem.dataset.longitude = place.location.lng();
  // gasItem.dataset.markerIndex = markers.length;
  gasItem.dataset.address = place.formattedAddress;

  gasItem.addEventListener('click', function() {
    const lat = parseFloat(this.dataset.latitude);
    const lng = parseFloat(this.dataset.longitude);
    map.panTo({ lat: lat, lng: lng });

    if (prevMarker) {
      prevMarker.setZIndex(0);
      prevMarker.setIcon({
        url: `images/icons/markers/${prevMarker.get('num')}.png`,
        scaledSize: new google.maps.Size(32, 32),
      });
      prevMarker.setLabel({
        text: `$${prevMarker.get('price')}`,
        fontSize: "12px",
        className: "price-label small",
      })
      prevMarker.set('size', 'small');
    }

    for (let i = 0; i < markers.length; i++) {
      const markerpos = markers[i].getPosition();
      if (markerpos.lat() === lat && markerpos.lng() === lng) {
        markers[i].setZIndex(1);
        markers[i].setIcon({
          url: `images/icons/markers/${markers[i].get('num')}.png`,
          scaledSize: new google.maps.Size(48, 48),
        })
        markers[i].setLabel({
          text: `$${markers[i].get('price')}`,
          fontSize: "12px",
          className: "price-label big",
        })
        markers[i].set('size', 'big');
        prevMarker = markers[i];
        break;
      }
    }
  });

  resultsWindow.appendChild(gasItem);
  createMarker(place);
}

function createMarker(place) {
  const gasdata = document.createElement('div');
  gasdata.setAttribute("class", "marker-data")

  const fuelPricesArray = place.fuelOptions.fuelPrices.map(fuelPrice => {
    const price = (fuelPrice.price.units - 0.01 + fuelPrice.price.nanos / 1e9).toFixed(2);
    if (fuelPrice.type === 'REGULAR_UNLEADED') {
      gasdata.dataset.price = price;
      return `REGULAR &ensp;&#36;${price} ${fuelPrice.price.currencyCode}`;
    }
    return `${fuelPrice.type} &ensp;&#36;${price} ${fuelPrice.price.currencyCode}`;
  });

  const marker = new google.maps.Marker({
    map: map,
    position: place.location,
    icon: {
      url: `images/icons/markers/${markernum}.png`,
      scaledSize: new google.maps.Size(32, 32),
    },
    label: {
      text: `$${gasdata.dataset.price}`,
      fontSize: "12px",
      className: "price-label small",
    },
    zIndex: 0,
  });
  marker.set('price', gasdata.dataset.price);
  marker.set('num', markernum);
  marker.set('size', 'small');

  gasdata.innerHTML = `
                      <div>
                        <span style="font-weight: 500; font-size: 14px;">
                          ${place.displayName}
                        </span>
                        <br>
                        <span style="font-weight: 400; font-size: 12px;">
                          ${place.formattedAddress.split(',')[0]}
                        </span>
                      </div>
                      <span style="font-weight: 300; font-size: 12px;">
                        ${fuelPricesArray.reverse().join('<br>')} 
                      </span>
                      </div>`;

  google.maps.event.addListener(marker, 'mouseover', function() {
    infoWindow.setContent(gasdata);
    infoWindow.open(map, marker);
  });

  google.maps.event.addListener(marker, 'mouseout', function() {
    infoWindow.close();
  });

  google.maps.event.addListener(marker, 'click', function() {
    const gasList = document.getElementById('gas-list');
    const gasitem = gasList.querySelector(`li[data-latitude="${place.location.lat()}"][data-longitude="${place.location.lng()}"]`);
    if (gasitem) {
      gasitem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (prevMarker) {
      prevMarker.setZIndex(0);
      prevMarker.setIcon({
        url: `images/icons/markers/${prevMarker.get('num')}.png`,
        scaledSize: new google.maps.Size(32, 32),
      });
      prevMarker.setLabel({
        text: `$${prevMarker.get('price')}`,
        fontSize: "12px",
        className: "price-label small",
      })
      prevMarker.set('size', 'small');
    }

    marker.setZIndex(1);
    marker.setIcon({
      url: `images/icons/markers/${marker.get('num')}.png`,
      scaledSize: new google.maps.Size(48, 48), 
    })
    marker.setLabel({
      text: `$${marker.get('price')}`,
      fontSize: "12px",
      className: "price-label big",
    })
    marker.set('size', 'big');
    prevMarker = marker;
  });

  markers.push(marker);
  markernum += 1;
}

async function getDistanceInfo(place) {
  const request = {
    origins: [map.getCenter()], 
    destinations: [place.location], 
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
  };

  try {
    const response = await new Promise((resolve, reject) => {
      distanceMatrix.getDistanceMatrix(request, (response, status) => {
        if (status === google.maps.DistanceMatrixStatus.OK) {
          resolve(response);
        } else {
          reject(new Error(`Distance Matrix request failed with status: ${status}`));
        }
      });
    });
    const results = response.rows[0].elements[0];
    const distance = results.distance.text;
    const duration = results.duration.text;

    return distance;
  } catch (error) {
    // do nothing here
  }
}

function toggleWindowOn() {
  const mapWindow = document.getElementById('map');
  const gasPage = document.getElementById('gas-page');

  if (!mapWindow.classList.contains('collapse')) {
    mapWindow.classList.add('collapse');
    gasPage.classList.add('show');
  }
}

function toggleWindowOff() {
  const mapWindow = document.getElementById('map');
  const gasPage = document.getElementById('gas-page');

  if (mapWindow.classList.contains('collapse')) {
    mapWindow.classList.remove('collapse');
    gasPage.classList.remove('show');
  }
}

function clearItems() {
  const resultsWindow = document.getElementById('gas-list');
  while (resultsWindow.firstChild) {
    resultsWindow.removeChild(resultsWindow.firstChild);
  }
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
  markernum = 1;
  prevMarker = null;
}

function clearWindow() {
  const resultsWindow = document.getElementById('gas-list');
  while (resultsWindow.firstChild) {
    resultsWindow.removeChild(resultsWindow.firstChild);
  }
  toggleWindowOff();
}

initMap();
initCookies();