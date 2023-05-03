var route, last_update, lang, show_scheduled = 1, timer, route_list, eta_data, stops_data, term_out, term_in;

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

function auto_refresh(timeout = $('#auto_refresh').val()) {
  if (typeof timer !== 'undefined') {
    clearTimeout(timer);
    timer = undefined;
  }

  if (timeout != 0) {
    timer = setTimeout(() => {
      get_eta_data();
      auto_refresh(timeout);
    }, timeout * 1000);
  }
}

function set_language() {
  if (lang == 6) {
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
      auto_refresh: '自動更新'
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
      auto_refresh: 'Refresh automatically'
    };
  }

  $('.icon_label > span:last-child').eq(0).html(text.language);
  $('.icon_label > span:last-child').eq(1).html(text.scheduled_departures);
  $('.icon_label > span:last-child').eq(2).html(text.auto_refresh);

  $('#lang > span:last-child').html(text.current_language);
  if (show_scheduled) {
    $('#show_scheduled > span:last-child').html(text.visible);
  } else {
    $('#show_scheduled > span:last-child').html(text.hidden);
  }
}

function change_route() {
  route = $('#route').val();
  localStorage.setItem('route', route);
  refresh_dir();
  get_eta_data();
  auto_refresh($('#auto_refresh').val());
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

function refresh_dir(direction) {
  stops_out = stops_data.filter((x) => {
    return x[0] == route && x[1] == 'O';
  });
  term_out = stops_out[stops_out.length - 1];

  $('#direction').html('<option value="O">' + term_out[lang] + '</option>');

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
    $('#direction').append('<option value="I">' + term_in[lang] + '</option>');
  } else {
    term_in = undefined;
  }

  if (typeof direction !== 'undefined') {
    $('#direction').val(direction);
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

  $('.last_update > span ').text(text.refreshing);

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
  $('.last_update > span ').text(text.last_update + last_update.toLocaleTimeString('en-GB'));

  if ($('#direction').val() === 'O') {
    stops = stops_out;
  } else {
    stops = stops_in;
  }

  $('.eta').text('');

  for (let stop_index = 0; stop_index < stops.length; stop_index++) {
    stop_section = create('div', undefined, $('.eta'), ['class', 'stop_section']);
    stop_name = create('h3', stop_index + ' • ' + stops[stop_index][lang], stop_section);
    stop_departures = create('div', undefined, stop_section);
    
    if (eta_data.busStop.length > 0) {
      stop_eta = eta_data.busStop.filter((x) => { return x.busStopId === stops[stop_index][3] });

      if (stop_eta.length > 0) {
        stop_eta = stop_eta[0].bus;

        if (!show_scheduled) {
          stop_eta = stop_eta.filter((x) => { return x.isScheduled == '0' });
        }
      } else {
        stop_eta = [];
      }
    } else {
      stop_eta = [];
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

$(async function() {
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

  if (localStorage.getItem('lang') !== null) {
    lang = localStorage.getItem('lang');
  } else {
    lang = 7;
  }
  set_language();

  $('#route').val(route);
  $('#route').prop('disabled', 0);
  refresh_dir();
  $('#direction').prop('disabled', 0);
  get_eta_data();
  auto_refresh();
  $('#refresh, #lang, #show_scheduled').prop('disabled', 0);
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

$('#direction').on('change', () => {
  get_eta_data();
  auto_refresh();
});

$('#auto_refresh').on('change', () => {
  auto_refresh();
});

$('#lang').click(() => {
  if (lang == 6) {
    lang = 7;
  } else {
    lang = 6;
  }
  localStorage.setItem('lang', lang);
  set_language();
  refresh_dir($('#direction').val());
  refresh_output();
});

$('#show_scheduled').click(() => {
  show_scheduled = !show_scheduled;

  if (show_scheduled) {
    $('#show_scheduled > span:last-child').html(text.visible);
  } else {
    $('#show_scheduled > span:last-child').html(text.hidden);
  }

  refresh_output();
});

$('#refresh').click(() => {
  $('#refresh').prop('disabled', 1);
  auto_refresh(0);
  get_eta_data();
  auto_refresh();
  setTimeout(() => {
    $('#refresh').prop('disabled', 0);
  }, 1000);
});

$('.settings_open').click(() => {
  $('.settings').css('display', 'flex');
});

$('.settings_close').click(() => {
  $('.settings').css('display', 'none');
});