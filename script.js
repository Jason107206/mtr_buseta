var route, last_update, route_list, eta_data, stops_data, term_out, term_in;
var direction = 'O';
var isScheduledDepartures = 1;
var languageCode;
var refreshInterval = 30, refreshTimer;

var icon = {
  error: '<span class="material-symbols-outlined">error</span>',
  warning: '<span class="material-symbols-outlined">warning</span>'
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
      get_eta_data();
      setRefreshTimer();
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
      minute: '分 ',
      second: '秒',
      no_departure: '沒有即將到達之班次',
      refreshing: '更新中...',
      last_update: '最後更新: ',

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
      minute: 'm ',
      second: 's',
      no_departure: 'No upcoming departure',
      refreshing: 'Refreshing...',
      last_update: 'Last updated: ',

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

function change_route() {
  route = $('#route').val();
  localStorage.setItem('route', route);
  refresh_dir();
  get_eta_data();
  setRefreshTimer();
}

function revert_route_change() {
  if (route != null) {
    if (localStorage.getItem('route') !== null) {
      route = localStorage.getItem('route');
    } else {
      route = route_list[0];
    }
  }
  $('#route').val(route);
}

function refresh_dir() {
  stops_out = stops_data.filter((x) => {
    return x[0] == route && x[1] == 'O';
  });
  term_out = stops_out[stops_out.length - 1];

  let stop_next = stops_data[stops_data.indexOf(term_out) + 1];

  let condition = [
    stop_next[0] == route,
    stop_next[1] == 'I'
  ];

  if (condition.every(x => x)) {
    stops_in = stops_data.filter((x) => {
      return x[0] == route && x[1] == 'I';
    });

    term_in = stops_in[stops_in.length - 1];
    $('#switchDirection').prop('disabled', 0)
  } else {
    term_in = undefined;
    $('#switchDirection').prop('disabled', 1)
  }
}

async function get_eta_data() {
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
  last_update = new Date();

  if (response.ok) {
    eta_data = await response.json();
  } else {
    eta_data = [];
  }

  refresh_output();
}

function refresh_output() {
  $('#lastUpdate').text(text.last_update + last_update.toLocaleTimeString('en-GB'));

  if (direction == 'O') {
    $('#direction').html(term_out[languageCode]);
    stops = stops_out;
  } else {
    $('#direction').html(term_in[languageCode]);
    stops = stops_in;
  }

  $('.eta').text('');

  for (let stop_index = 0; stop_index < stops.length; stop_index++) {
    stop_section = create('div', undefined, $('.eta'), ['class', 'stop_section']);
    stop_name = create('h3', stop_index + ' • ' + stops[stop_index][languageCode], stop_section);
    stop_departures = create('div', undefined, stop_section);

    if (eta_data.hasOwnProperty('busStop')) {
      stop_eta = eta_data.busStop;
    } else {
      stop_eta = [];
    }
    
    if (stop_eta.length > 0) {
      stop_eta = eta_data.busStop.filter((x) => { return x.busStopId === stops[stop_index][3] });
    }

    if (stop_eta.length > 0) {
      stop_eta = stop_eta[0].bus;

      if (!isScheduledDepartures) {
        stop_eta = stop_eta.filter((x) => { return x.isScheduled == '0' });
      }
    }

    if (stop_eta.length == 0) {
      create('span', icon.error + text.no_departure, stop_departures, ['class', 'no_departure']);
      continue;
    }

    for (let i = 0; i < stop_eta.length; i++) {
      let condition = [
        stop_index < stops.length - 1,
        stop_eta[i].isScheduled == '1'
      ];

      if (condition.every(x => x)) {
        secs = parseInt(stop_eta[i].departureTimeInSecond);
      } else {
        secs = parseInt(stop_eta[i].arrivalTimeInSecond);
      }

      time = new Date(last_update);
      time.setSeconds(time.getSeconds() + secs);

      if (secs > 59) {
        eta_text = Math.floor(secs / 60).toString() + text.minute + (secs % 60).toString() + text.second;
      } else if (secs > 0) {
        eta_text = secs + text.second;
      } else if (condition.every(x => x)) {
        eta_text = text.departing;
      } else {
        eta_text = text.arriving;
      }

      departure = create('div', undefined, stop_departures, ['class', 'departure']);

      if (secs < 179) {
        $(departure).addClass('arriving');
      }
      
      create('span', eta_text, departure, ['class', 'eta_text']);
      create('span', time.toLocaleTimeString('en-GB'), departure);
      create('span', '🚌 ' + stop_eta[i]['busId'], departure);

      if (stop_eta[i]['busRemark'] == '受交通擠塞影響，到站時間可能稍為延遲') {
        create('span', text.delayed, departure, ['class', 'chip chip_delayed']);
      }

      if (stop_eta[i].isScheduled == '1') {
        create('span', text.scheduled, departure, ['class', 'chip chip_scheduled']);
      }
    }
  };
}

$(document).ready(async function() {
  route_list = [];
  response = await fetch('mtr_bus_stops.csv');
  text = await response.text();
  stops_data = $.csv.toArrays(text);

  stops_data.splice(0, 1);
  stops_data.filter(x => {
    if (route_list.indexOf(x[0]) == -1) {
      route_list.push(x[0]);
      $('#opt_route').append('<option value="' + x[0] + '" />');
    }
  });

  if (localStorage.getItem('route') !== null) {
    route = localStorage.getItem('route');
  } else {
    route = route_list[0];
  }

  if (localStorage.getItem('languageCode') !== null) {
    languageCode = localStorage.getItem('languageCode');
  } else {
    languageCode = 7;
  }
  initiateLanguage();

  $('#route').val(route); 
  refresh_dir();
  get_eta_data();
  setRefreshTimer();
});

$('#route').on('change', () => {
  if (route_list.includes($('#route').val()) === false) {
    revert_route_change();
  }
});

$('#route').on('input', () => {
  $('#route').val($('#route').val().toUpperCase());
  if (route_list.includes($('#route').val())) {
    change_route();
  }
});

$('#route').on('keydown', (event) => {
  if (event.which == 13) {
    event.preventDefault();
    if (route_list.includes($('#route').val())) {
      change_route();
    } else {
      revert_route_change();
    }
  }
});

$('#refresh').click(() => {
  $('#refresh').prop('disabled', 1);
  setTimeout(() => {
    $('#refresh').prop('disabled', 0);
  }, 800);
  
  clearRefreshTimer();
  get_eta_data();
  setRefreshTimer();
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
  get_eta_data();
});

$('.settings_open').click(() => {
  $('.settings').css('display', 'flex');
});

$('.settings_close').click(() => {
  $('.settings').css('display', 'none');
});

$('#switchLanguage').click(() => {
  if (languageCode == 6) {
    languageCode = 7;
  } else {
    languageCode = 6;
  }
  localStorage.setItem('languageCode', languageCode);
  initiateLanguage();
  refresh_dir();
  refresh_output();
});

$('#toggleScheduledDepartures').click(() => {
  isScheduledDepartures = !isScheduledDepartures;

  if (isScheduledDepartures) {
    $('#toggleScheduledDepartures > span:last-child').html(text.visible);
  } else {
    $('#toggleScheduledDepartures > span:last-child').html(text.hidden);
  }

  refresh_output();
});

$('#switchRefreshInterval').on('change', () => {
  clearRefreshTimer();
  refreshInterval = $('#switchRefreshInterval').val();
  setRefreshTimer();
});