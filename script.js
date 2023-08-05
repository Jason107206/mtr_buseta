var route, lastUpdate, routeList, rawArrivalData, stopsData, terminusOutbound, terminusInbound;
var direction = 'O';
var isScheduledDepartures = 1;
var languageCode;
var refreshInterval = 30, refreshTimer;

const icon = {
  error: '<span class="material-symbols-outlined">error</span>',
  warning: '<span class="material-symbols-outlined">warning</span>',
  bus: '<span class="material-symbols-outlined">directions_bus</span>'
}

function create(type, text, append_to, ...attributes) {
  element = document.createElement(type);

  if (typeof text !== 'undefined') {
    $(element).html(text);
  }

  if (typeof append_to !== 'undefined') {
    append_to.append(element);
  }

  if (typeof attributes !== 'undefined') {
    for (i in attributes) {
      element.setAttribute(attributes[i][0], attributes[i][1]);
    }
  }

  return element;
}

function clearRefreshTimer() {
  clearTimeout(refreshTimer);
  refreshTimer = undefined;
}

function setRefreshTimer() {
  if (typeof refreshTimer !== 'undefined') {
    clearRefreshTimer();
  }

  if (refreshInterval > 0) {
    refreshTimer = setTimeout(() => {
      (async function() {
        rawArrivalData = await retrieveArrivalData();
        initializeETA();
        setRefreshTimer();
      })();
    }, refreshInterval * 1000);
  }
}

function initiateLanguage() {
  if (languageCode == 6) {
    text = {
      arriving: '已到達',
      departing: '已開出',
      scheduled: '編定',
      delayed: '延遲',
      normal: '正常',
      minute: '分',
      second: '秒',
      unavailable: '沒有即將到達之班次',
      refreshing: '更新中...',
      lastUpdate: '最後更新: ',

      current_language: '中文',
      language: '語言',
      scheduled_departures: '編定班次',
      visible: '顯示',
      hidden: '隱藏',
      auto_refresh: '自動更新',
      disabled: '已停用'
    };
  } else {
    text = {
      arriving: 'Arriving',
      departing: 'Departing',
      scheduled: 'Scheduled',
      delayed: 'Delayed',
      normal: 'Normal',
      minute: 'm',
      second: 's',
      unavailable: 'No upcoming departure',
      refreshing: 'Refreshing...',
      lastUpdate: 'Last updated: ',

      current_language: 'English',
      language: 'Language',
      scheduled_departures: 'Scheduled departures',
      visible: 'Visible',
      hidden: 'Hidden',
      auto_refresh: 'Refresh automatically',
      disabled: 'Disabled'
    };
  }

  $('.switchLanguage .title').html(text.language);
  $('.toggleScheduledDepartures .title').html(text.scheduled_departures);
  $('.switchRefreshInterval .title').html(text.auto_refresh);

  $('#switchRefreshInterval option').eq(0).html(text.disabled);
  $('#switchRefreshInterval option').eq(1).html('5 ' + text.second);
  $('#switchRefreshInterval option').eq(2).html('10 ' + text.second);
  $('#switchRefreshInterval option').eq(3).html('20 ' + text.second);
  $('#switchRefreshInterval option').eq(4).html('30 ' + text.second);
  $('#switchRefreshInterval option').eq(5).html('60 ' + text.second);

  $('#switchLanguage > span:last-child').html(text.current_language);
  if (isScheduledDepartures) {
    $('#toggleScheduledDepartures > span:last-child').html(text.visible);
  } else {
    $('#toggleScheduledDepartures > span:last-child').html(text.hidden);
  }
}

function initializeRoute() {
  stopListOutbound = stopsData.filter((x) => {
    return x[0] == route && x[1] == 'O';
  });
  terminusOutbound = stopListOutbound[stopListOutbound.length - 1];

  let stopAfterLast = stopsData[stopsData.indexOf(terminusOutbound) + 1];

  let condition = [
    stopAfterLast[0] == route,
    stopAfterLast[1] == 'I'
  ];

  if (condition.every(x => x)) {
    stopListInbound = stopsData.filter((x) => {
      return x[0] == route && x[1] == 'I';
    });
    terminusInbound = stopListInbound[stopListInbound.length - 1];
    $('#switchDirection').prop('disabled', 0)
  } else {
    stopListInbound = undefined;
    terminusInbound = undefined;
    $('#switchDirection').prop('disabled', 1)
  }
}

async function retrieveArrivalData() {
  const url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule';
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'language': 'zh',
      'routeName': route
    })
  };

  $('#lastUpdate').text(text.refreshing);

  response = await fetch(url, init);
  lastUpdate = new Date();

  if (response.ok) {
    rawArrivalData = await response.json();
  } else {
    rawArrivalData = [];
  }

  return rawArrivalData;
}

function initializeETA() {
  $('#lastUpdate').text(text.lastUpdate + lastUpdate.toLocaleTimeString('en-GB'));

  for (let stopIndex = 0; stopIndex < currentStopList.length; stopIndex++) {
    if (rawArrivalData.hasOwnProperty('busStop')) {
      arrivalData = rawArrivalData.busStop;
    } else {
      arrivalData = [];
    }

    if (arrivalData.length > 0) {
      arrivalData = rawArrivalData.busStop.filter((x) => { return x.busStopId === currentStopList[stopIndex][3] });
    }

    if (arrivalData.length > 0) {
      arrivalData = arrivalData[0].bus;

      if (!isScheduledDepartures) {
        arrivalData = arrivalData.filter((x) => { return x.isScheduled == '0' });
      }
    }

    if (document.getElementById('busStop' + stopIndex) == null) {
      busStopName = create('h3', currentStopList[stopIndex][languageCode], $('.eta'), ['class', 'busStopName']);
      departureContainer = create('div', undefined, $('.eta'), ['class', 'departureContainer'], ['id', 'busStop' + stopIndex]);
      $(departureContainer).hide();

      busStopName.addEventListener('click', () => {
        $('#' + ('busStop' + stopIndex)).slideToggle();
      });
    } else {
      departureContainer = document.getElementById('busStop' + stopIndex);
      departureContainer.innerHTML = '';
    }

    if (arrivalData.length == 0) {
      unavailable = create('span', icon.error + text.unavailable, departureContainer, ['class', 'unavailable']);
      continue;
    }

    for (let i = 0; i < arrivalData.length; i++) {
      let condition = [
        stopIndex < currentStopList.length - 1,
        arrivalData[i].isScheduled == '1'
      ];

      if (condition.every(x => x)) {
        countdown = parseInt(arrivalData[i].departureTimeInSecond);
      } else {
        countdown = parseInt(arrivalData[i].arrivalTimeInSecond);
      }

      departure = create('div', undefined, departureContainer, ['class', 'departure']);
      departureStatus = create('div', undefined, departure, ['class', 'departureStatus']);

      if (arrivalData[i]['busRemark'] == '受交通擠塞影響，到站時間可能稍為延遲') {
        departure.classList.add('delayed');
        departureStatus.classList.add('delayed');
        departureStatus.append(create('span', text.delayed));
      } else if (arrivalData[i].isScheduled == '1') {
        departure.classList.add('scheduled');
        departureStatus.classList.add('scheduled');
        departureStatus.append(create('span', text.scheduled));
      } else {
        departure.classList.add('onTime');
        departureStatus.classList.add('onTime');
        departureStatus.append(create('span', text.normal));
      }

      departureID = create('div', undefined, departure, ['class', 'departureID']);
      departureID.append(create('span', icon.bus));
      departureID.append(create('span', arrivalData[i]['busId']));

      departureCountdown = create('div', undefined, departure, ['class', 'departureCountdown']);

      if (countdown > 60) {
        departureCountdown.append(create('span', Math.floor(countdown / 60).toString()));
        departureCountdown.append(create('span', text.minute));
        departureCountdown.append(create('span', (countdown % 60).toString()));
        departureCountdown.append(create('span', text.second));

        if (countdown < 179) {
          departureCountdown.classList.add('arriving');
        }
      } else if (countdown > 0) {
        departureCountdown.append(create('span', (countdown % 60).toString()));
        departureCountdown.append(create('span', text.second));
        departureCountdown.classList.add('arriving');
      } else if (stopIndex + 1 == currentStopList.length) {
        departureCountdown.append(create('span', '-'));
      } else if (condition.every(x => x)) {
        departureCountdown.append(create('span', text.departing));
        departureCountdown.classList.add('arriving');
      } else {
        departureCountdown.append(create('span', text.arriving));
        departureCountdown.classList.add('arriving');
      }
    }
  }
}

function initializeStops() {
  $('.eta').text('');

  if ((typeof stopListInbound == 'undefined') || (direction == 'O')) {
    $('#direction').html(terminusOutbound[languageCode]);
    currentStopList = stopListOutbound;
  } else {
    $('#direction').html(terminusInbound[languageCode]);
    currentStopList = stopListInbound;
  }

  initializeETA();
}

function acceptRouteInput() {
  localStorage.setItem('route', route);
  initializeRoute();
  (async function() {
    rawArrivalData = await retrieveArrivalData();
    initializeStops();
    setRefreshTimer();
  })();
  setRefreshTimer();
}

function rejectRouteInput() {
  if (route != null) {
    if (localStorage.getItem('route') !== null) {
      route = localStorage.getItem('route');
    } else {
      route = routeList[0];
    }
  }
  $('#route').val(route);
}

$(document).ready(async function() {  
  routeList = [];
  response = await fetch('mtr_bus_stops.csv');
  text = await response.text();
  stopsData = $.csv.toArrays(text);

  stopsData.splice(0, 1);
  stopsData.filter(x => {
    if (routeList.indexOf(x[0]) == -1) {
      routeList.push(x[0]);
      $('#opt_route').append('<option value="' + x[0] + '" />');
    }
  });

  if (localStorage.getItem('route') !== null) {
    route = localStorage.getItem('route');
  } else {
    route = routeList[0];
  }

  if (localStorage.getItem('languageCode') !== null) {
    languageCode = localStorage.getItem('languageCode');
  } else {
    languageCode = 7;
  }
  initiateLanguage();

  $('#route').val(route);
  initializeRoute();

  (async function() {
    rawArrivalData = await retrieveArrivalData();
    initializeStops();
    setRefreshTimer();
  })();
});

$('#route').on('change', () => {
  routeInput = $('#route').val().toUpperCase();
  $('#route').val(routeInput);
  if ((routeList.includes(routeInput)) && (routeInput != route)) {
    route = routeInput;
    acceptRouteInput();
  } else {
    rejectRouteInput();
  }
});

$('#route').on('input', () => {
  routeInput = $('#route').val().toUpperCase();
  $('#route').val(routeInput);
  if (routeList.includes(routeInput) && (routeInput != route)) {
    route = routeInput;
    acceptRouteInput();
  }
});

$('#refresh').click(() => {
  $('#refresh').prop('disabled', 1);
  setTimeout(() => {
    $('#refresh').prop('disabled', 0);
  }, 800);
  clearRefreshTimer();

  (async function() {
    rawArrivalData = await retrieveArrivalData();
    initializeETA();
    setRefreshTimer();
  })();
});

$('#switchDirection').click(() => {
  $('#switchDirection').prop('disabled', 1);
  setTimeout(() => {
    $('#switchDirection').prop('disabled', 0);
  }, 800);

  if (direction == 'I') {
    direction = 'O';
  } else {
    direction = 'I';
  }

  (async function() {
    rawArrivalData = await retrieveArrivalData();
    initializeStops();
    setRefreshTimer();
  })();
});

$('.settings_open').click(() => {
  $('.settingsContainer').show();
});

$('.settings_close').click(() => {
  $('.settingsContainer').hide();
});

$('#switchLanguage').click(() => {
  if (languageCode == 6) {
    languageCode = 7;
  } else {
    languageCode = 6;
  }
  localStorage.setItem('languageCode', languageCode);

  initiateLanguage();
  initializeRoute();
  initializeStops();
});

$('#toggleScheduledDepartures').click(() => {
  isScheduledDepartures = !isScheduledDepartures;

  if (isScheduledDepartures) {
    $('#toggleScheduledDepartures > span:last-child').html(text.visible);
  } else {
    $('#toggleScheduledDepartures > span:last-child').html(text.hidden);
  }

  initializeETA();
});

$('#switchRefreshInterval').on('change', () => {
  clearRefreshTimer();
  refreshInterval = $('#switchRefreshInterval').val();
  setRefreshTimer();
});