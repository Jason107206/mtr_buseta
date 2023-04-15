var route, last_update, lang, show_scheduled = 1, timer, route_list, eta_data, stops_data, term_out, term_in;

function create(type, text, append_to, ...attributes) {
  element = document.createElement(type);
  append_to.append(element);
  $(element).html(text);

  if (typeof attributes !== 'undefined') {
    for (i in attributes) {
      element.setAttribute(attributes[i][0], attributes[i][1]);
    }
  }

  return element;
}

function auto_refresh(timeout) {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }

  if (timeout != 0) {
    timer = setTimeout(() => {
      get_eta_data();
      auto_refresh(timeout);
    }, timeout * 1000);
  }
}

function refresh_dir(direction) {
  stops_out = stops_data.filter((x) => {
    return x[0] === route && x[1] === 'O';
  });
  term_out = stops_out[stops_out.length - 1];

  $('#direction').html('');
  $('#direction').append('<option value="O">' + term_out[lang] + '</option>');

  let stop_next_index = stops_data.indexOf(term_out) + 1;
  let stop_next = stops_data[stop_next_index];

  let condition = [
    stop_next[0] === route,
    stop_next[1] === 'I'
  ];

  if (condition.every(x => x)) {
    stops_in = stops_data.filter((x) => {
      return x[0] === route && x[1] === 'I';
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

  if (lang == 6) {
    $('.last_update > span ').text('更新中...');
  } else {
    $('.last_update > span ').text('Refreshing...');
  }
  
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
  if ($('#direction').val() === 'O') {
    stops = stops_out;
  } else {
    stops = stops_in;
  }

  if (lang == 6) {
    $('.last_update > span ').text('最後更新: ' + last_update.toLocaleTimeString('en-GB'));
  } else {
    $('.last_update > span ').text('Last updated: ' + last_update.toLocaleTimeString('en-GB'));
  }
  
  $('.eta').text('');
  
  for (let stop_index = 0; stop_index < stops.length; stop_index++) {
    table = document.createElement('table');
    $('.eta').append(table);

    row = document.createElement('tr');
    table.append(row);
    create('td', stop_index + ' | ' + stops[stop_index][lang], row, ['colspan', '3']);

    route_eta = eta_data['busStop'];

    if (route_eta.length > 0) {
      stop_eta = route_eta.filter((x) => { return x['busStopId'] === stops[stop_index][3] });

      if (stop_eta.length > 0) {
        stop_eta = stop_eta[0]['bus'];
      }
    } else {
      stop_eta = [];
    }

    for (let i = 0; i < stop_eta.length; i++) {
      let condition = [
        show_scheduled,
        stop_eta[i]['isScheduled'] == '0'
      ];

      if (condition.some(x => x)) {
        let condition = [
          stop_index < stops.length - 1,
          stop_eta[i]['isScheduled'] == '1'
        ]

        if (condition.every(x => x)) {
          secs = parseInt(stop_eta[i]['departureTimeInSecond']);
        } else {
          secs = parseInt(stop_eta[i]['arrivalTimeInSecond']);
        }

        time = new Date(last_update);
        time.setSeconds(time.getSeconds() + secs);

        if (secs > 59) {
          if (lang == 6) {
            eta = Math.floor(secs / 60).toString() + '分 ' + (secs % 60).toString() + '秒';
          } else {
            eta = Math.floor(secs / 60).toString() + 'm ' + (secs % 60).toString() + 's';
          }
        } else if (secs > 0) {
          if (lang == 6) {
            eta = secs + '秒';
          } else {
            eta = secs + 's';
          }
        } else {
          eta = '-';
        }

        row = document.createElement('tr');
        table.append(row);

        if (stop_eta[i]['isScheduled'] == '1') {
          row.setAttribute('class', 'scheduled');
        } else if (secs < 179) {
          row.setAttribute('class', 'arriving');
        } else {
          row.setAttribute('class', 'normal');
        }

        create('td', stop_eta[i]['busId'], row);
        create('td', time.toLocaleTimeString('en-GB'), row);
        create('td', eta, row);
      }
    }

    if (table.rows.length == 1) {
      row = document.createElement('tr');
      table.append(row);
      row.setAttribute('class', 'no_departure');
      
      if (lang == 6) {
        no_dep_text = '<span class="material-symbols-outlined">error</span><span>沒有即將到達之班次</span>';
      } else {
        no_dep_text = '<span class="material-symbols-outlined">error</span><span>No upcoming departure</span>';
      }
      
      create('td', no_dep_text, row, ['colspan', '3']);
    }
  };

  if ($('#show_scheduled').is(':disabled')) {
    $('#auto_refresh').prop('disabled', 0);
    $('#stop_lang').prop('disabled', 0);
    $('#show_scheduled').prop('disabled', 0);
    $('#refresh').prop('disabled', 0);
    $('.eta').show();
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

$(async function() {
  $('#route').prop('disabled', 1);
  $('#direction').prop('disabled', 1);
  $('#stop_lang').prop('disabled', 1);
  $('#show_scheduled').prop('disabled', 1);
  $('#auto_refresh').prop('disabled', 1);
  $('#refresh').prop('disabled', 1);

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

    if (lang == 6) {
      $('#stop_lang > span:last-child').html('中文');
    }
  } else {
    lang = 7;
  }

  $('#route').val(route);
  $('#route').prop('disabled', 0);
  $('.card:not(#card_eta)').show();
  refresh_dir();
  $('#direction').prop('disabled', 0);
  get_eta_data();
  auto_refresh($('#auto_refresh').val());
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
  auto_refresh($('#auto_refresh').val());
  get_eta_data();
});

$('#auto_refresh').on('change', () => {
  auto_refresh($('#auto_refresh').val());
});

$('#stop_lang').click(() => {
  if (lang == 6) {
    lang = 7;
  } else {
    lang = 6;
  }

  if (lang == 6) {
    $('#stop_lang > span:last-child').html('中文');
  } else {
    $('#stop_lang > span:last-child').html('English');
  }

  localStorage.setItem('lang', lang);
  refresh_dir($('#direction').val());
  refresh_output();
});

$('#show_scheduled').click(() => {
  show_scheduled = !show_scheduled;

  if (show_scheduled) {
    $('#show_scheduled > span:first-child').html('visibility');
    $('#show_scheduled > span:last-child').html('Visible');
  } else {
    $('#show_scheduled > span:first-child').html('visibility_off');
    $('#show_scheduled > span:last-child').html('Hidden');
  }

  refresh_output();
});

$('#refresh').click(() => {
  auto_refresh($('#auto_refresh').val());
  get_eta_data();
});

$('.settings_open').click(() => {
  $('.settings').css('display', 'flex');
});

$('.settings_close').click(() => {
  $('.settings').css('display', 'none');
});