let map, places, geocoder, infowindow, distancematrix, markers = [], markernum = 1;


let size = 3220; // approximately 2 miles
const increaseSize = 1660, maxSize = 16601; // approximately 10 miles

let maxResult = 6;

let newPos = false;

let addresses = []

let rankPreference;

let prevMarker;

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Place, SearchNearbyRankPreference  } = await google.maps.importLibrary("places");

  geocoder = new google.maps.Geocoder();
  infowindow = new google.maps.InfoWindow();
  distancematrix = new google.maps.DistanceMatrixService();
  places = Place;
  rankPreference = SearchNearbyRankPreference;

  map = new Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 16,
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

  google.maps.event.addListener(map, "zoom_changed", function() {
    document.getElementById('show-gas-button').style.display = "flex";
    clearInput();
  });

  google.maps.event.addListener(map, "dragend", function() {
    document.getElementById('show-gas-button').style.display = "flex";
    newPos = true;
    clearInput();
  });

  initNavigationActions();
  centerOnUser();
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

async function initNavigationActions() {
  const input = document.getElementById('search-bar');
  let autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener('place_changed', () => {
    const address = document.getElementById('search-bar').value.trim();
    geocoder.geocode({ 'address': address }, function(results, status) {
      if (status === 'OK') {
        const location = results[0].geometry.location;
        map.setCenter(location);
      } else {
        alert('Geocoder was unsucessful: ' + status);
      }
    });
    document.getElementById('show-gas-button').style.display = "flex";
  });

  document.getElementById('search-bar').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      document.activeElement.blur();
      const address = document.getElementById('search-bar').value.trim();
      geocoder.geocode({ 'address': address }, function(results, status) {
        if (status === 'OK') {
          const location = results[0].geometry.location;
          map.setCenter(location);
        } else {
          alert('Geocoder was unsucessful: ' + status);
        }
      });
      document.getElementById('show-gas-button').style.display = "flex";
    }
  });

  document.getElementById('find-me-button').addEventListener('click', () => {
    centerOnUser();
    document.getElementById('show-gas-button').style.display = "flex";
  });

  document.getElementById('show-gas-button').addEventListener('click', function() {
    getGeocode();
    this.style.display = "none"; // hide button after results
  });

  document.getElementById('clear-result-button').addEventListener('click', () => {
    clearInput();
    clearResults();
    clearMarkers();
    document.getElementById('show-gas-button').style.display = "none";
    document.getElementById('results-tab').style.display = "none";
  });

  document.getElementById('toggle-results-button').addEventListener('click', function() {
    document.getElementById('results-tab').classList.toggle('collapse');
  });

  document.getElementById('sort-results-button').addEventListener('click', function() {
    document.getElementById('sort-options').classList.toggle('collapse');
  });

  document.getElementById('efficient-sort').addEventListener('click', function() {
    document.getElementById('efficient-sort').classList.toggle('active');
    document.getElementById('prices-sort').classList.remove('active');
    document.getElementById('distances-sort').classList.remove('active');
    sortBy(1);
  });

  document.getElementById('prices-sort').addEventListener('click', function() {
    document.getElementById('efficient-sort').classList.remove('active');
    document.getElementById('prices-sort').classList.toggle('active');
    document.getElementById('distances-sort').classList.remove('active');
    sortBy(2);
  });

  document.getElementById('distances-sort').addEventListener('click', function() {
    document.getElementById('efficient-sort').classList.remove('active');
    document.getElementById('prices-sort').classList.remove('active');
    document.getElementById('distances-sort').classList.toggle('active');
    sortBy(3);
  });

  document.getElementById('range-slider').addEventListener('input', function() {
    document.getElementById('range-value').textContent = document.getElementById('range-slider').value;
    increaseRange(document.getElementById('range-slider').value);
    document.getElementById('show-gas-button').style.display = "flex";
  });

  document.getElementById('set-range-button').addEventListener('click', function() {
    document.getElementById('range-options').classList.toggle('collapse');
  });
}

async function getGeocode() {
  if (newPos === true) {
    clearResults();
    clearMarkers();
  }
  
  const address = document.getElementById('search-bar').value.trim();

  if (address === "") { // search using map crosshair (no address typed in search-bar)
    const location = map.getCenter();
    showGasStations(location);
  } else {
    transformAddress(address);
  }
}

async function transformAddress(address) {
  geocoder.geocode({ 'address': address }, function(results, status) {
    if (status === 'OK') {
      const location = results[0].geometry.location;
      map.setCenter(location);
      showGasStations(location);
    } else {
      alert('Geocoder was unsucessful: ' + status);
    }
  });
}

async function showGasStations(location) {
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

  try {
    const response = await places.searchNearby(request);
    const results = response.places.filter(place => 
      place.fuelOptions && place.fuelOptions.fuelPrices && !addresses.includes(place.formattedAddress)
    );

    if (results.length === 0) {
      size += increaseSize;
      if (size > maxSize) {
        alert('Maximum search radius reached; try a different location');
        return;
      }
      showGasStations(location); // recursively call if no new results are returned
    }
    
    for (let place of results) {
      await appendResults(place);
    }

    document.querySelectorAll('.switch-prices').forEach(button => {
      button.addEventListener('click', function(event) {
        event.stopPropagation();

        // Get all the switch-price buttons
        const allSwitchPrices = document.querySelectorAll('.switch-prices');

        // Get all the fuel prices
        const allFuelPrices = document.querySelectorAll('.fuel-price');

        // Check the current state of the clicked button
        const isCreditPrice = this.textContent === "credit price";

        // Update all switch-price buttons
        allSwitchPrices.forEach(switchPrice => {
          if (isCreditPrice) {
            switchPrice.textContent = "estimated cash price";
            switchPrice.style.color = "rgb(78, 221, 78)";
          } else {
            switchPrice.textContent = "credit price";
            switchPrice.style.color = "orange";
          }
        });

        // Update all fuel-price elements
        allFuelPrices.forEach(fuelPrice => {
          let price = parseFloat(fuelPrice.textContent); 
          if (isCreditPrice) {
            price -= 0.10; 
          } else {
            price += 0.10; 
          }
          fuelPrice.textContent = price.toFixed(2); 
        });

        markers.forEach(marker => {
          let price = parseFloat(marker.get('price'));
          if (isCreditPrice) {
            price -= 0.10;
            marker.setLabel({
              text: `$${price.toFixed(2)}`,
              fontSize: "12px",
              className: `price-label ${marker.get('size')}`,
            })
          } else {
            price += 0.10;
            marker.setLabel({
              text: `$${price.toFixed(2)}`,
              fontSize: "12px",
              className: `price-label ${marker.get('size')}`,
            })
          }
          marker.set('price', price.toFixed(2));
        })
      });
    });
  

  } catch (error) {
    alert('Places service was unsuccessful: ' + error.message);
  }
}

async function appendResults(place) {
  const results = document.getElementById('results-list');
  const gasitem = document.createElement('li');

  const fueldata = place.fuelOptions.fuelPrices.map(fuelPrice => {
    const price = (fuelPrice.price.units - 0.01 + fuelPrice.price.nanos / 1e9).toFixed(2);
    if (fuelPrice.type === 'REGULAR_UNLEADED') {
      gasitem.dataset.cost = price;
      return `REGULAR <br>&#36;<span class="fuel-price">${price}</span> ${fuelPrice.price.currencyCode}`;
    }
    return `${fuelPrice.type} <br>&#36;<span class="fuel-price">${price}</span> ${fuelPrice.price.currencyCode}`;
  });

  let distanceinfo = "";
  let response = await getDistanceInfo(place);

  if (response !== undefined) {
    if (parseFloat(response[0]) > (size / increaseSize) * 1.15) {
      return;
    }
    distanceinfo = `<span class="distance-info">
                      ${response[0]} miles away
                      <span class="hidden-info">
                        ${response[1]}
                      </span>
                    </span>
                    <br>`;
    gasitem.dataset.distance = response[0];
  }
  let fuelordered = fueldata.reverse().map(price => `<span>${price}</span>`).join('');

  gasitem.innerHTML = ` <div class="gas-item-div">
                          <div class="gas-item-bar">
                            <div>
                              <span style="font-weight: 500; font-size: 18px;">
                                ${place.displayName}
                              </span>
                              <br>
                              <span class="gas-address">
                                ${place.formattedAddress.split(',')[0]}
                              </span>
                              <br>
                            </div>
                            <div class="gas-item-button">
                              <button class="star-button">
                                <img src="images/icons/star.png">
                              </button>
                              <button class="open-google-button">
                                <img src="images/icons/share.png">
                              </button>
                            </div>
                          </div>
                        </div>

                        <br>
                        <span class="switch-prices">credit price</span><br>
                        
                        <div class="gas-data-div">
                          ${fuelordered}
                        </div>

                        <span style="font-size: 14px; font-weight: 400;";>
                          ${distanceinfo}
                        </span>
                      `;

  gasitem.querySelector('.gas-address').addEventListener('click', function(event) {
    event.stopPropagation(); // prevent parent event to activate
    navigator.clipboard.writeText(place.formattedAddress)
      .then(() => {
        alert("Copied to clipboard!");
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  });

  gasitem.querySelector('.open-google-button').addEventListener('click', function(event) {
    event.stopPropagation();
    const url = `https://www.google.com/maps?q=${place.location.lat()},${place.location.lng()}`;
    window.open(url, '_blank');
  })

  // to-do star button (add star to marker)
  gasitem.querySelector('.star-button').addEventListener('click', function(event) {
    event.stopPropagation(); // prevent parent event to activate
    if (this.classList.contains('toggle')) {
      this.classList.toggle
    } else {
      
      
    }
    this.classList.toggle('toggle');
  });

  gasitem.dataset.latitude = place.location.lat();
  gasitem.dataset.longitude = place.location.lng();
  // gasitem.dataset.markerIndex = markers.length;
  gasitem.dataset.address = place.formattedAddress;

  gasitem.addEventListener('click', function() {
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

  results.appendChild(gasitem);
  createMarker(place); // add markers here
  markernum += 1;

  addresses.push(place.formattedAddress);

  document.getElementById('results-tab').style.display = "block";    
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
      distancematrix.getDistanceMatrix(request, (response, status) => {
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

    return [distance, duration];
  } catch (error) {
    // do nothing here
  }
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
    infowindow.setContent(gasdata);
    infowindow.open(map, marker);
  });

  google.maps.event.addListener(marker, 'mouseout', function() {
    infowindow.close();
  });

  google.maps.event.addListener(marker, 'click', function() {
    const gasitem = document.querySelector(`li[data-latitude="${place.location.lat()}"][data-longitude="${place.location.lng()}"]`);
    if (gasitem) {
      gasitem.scrollIntoView({ behavior: "smooth", block: "center" });
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
}

function clearResults() {
  newPos = false;
  const results = document.getElementById('results-list');
  document.getElementById('results-tab').classList.remove('collapse');
  document.getElementById('range-options').classList.remove('collapse');
  document.getElementById('sort-options').classList.remove('collapse');
  while (results.firstChild) {
    results.removeChild(results.firstChild);
  }
  while (addresses.length > 0) {
    addresses.pop();
  }
}

function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
  prevMarker = null;
  markernum = 1;
}

function clearInput() {
  var input = document.getElementById('search-bar');
  input.value = "";
}

async function sortBy(rule) {
  const list = document.getElementById('results-list');
  const itemsArray = Array.from(list.children);

  if (rule === 1) {
      // Sort by efficiency (you would define what this means)
      const maxPrice = Math.max(...itemsArray.map(item => parseFloat(item.dataset.cost)));
      const maxDistance = Math.max(...itemsArray.map(item => parseFloat(item.dataset.distance)))
      
      itemsArray.sort((a, b) => {
        let pricediffA = maxPrice - parseFloat(a.dataset.cost);
        let pricediffB = maxPrice - parseFloat(b.dataset.cost);

        let distancediffA = maxDistance - parseFloat(a.dataset.distance);
        let distancediffB = maxDistance - parseFloat(b.dataset.distance);

        const scoreA = pricediffA + distancediffA * 0.3;
        const scoreB = pricediffB + distancediffB * 0.3;
        return scoreB - scoreA;
      });
  } else if (rule === 2) {
      // Sort by prices
      itemsArray.sort((a, b) => {
        return parseFloat(a.dataset.cost) - parseFloat(b.dataset.cost);
      });
  } else if (rule === 3) {
      // Sort by distances
      itemsArray.sort((a, b) => {
        return parseFloat(a.dataset.distance) - parseFloat(b.dataset.distance);
      });
  }

  // Clear the current list
  list.innerHTML = '';

  // Append the sorted items back to the list
  itemsArray.forEach(item => {
    list.appendChild(item);
  });
}

async function increaseRange(value) {
  size = value * increaseSize;
  maxResult = (size / increaseSize) * 3;
}

initMap();