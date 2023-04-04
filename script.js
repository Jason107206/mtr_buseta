var eta_data, stops_data, timer, last_update, term_out, term_in;

function create(type, text, append_to, ...attributes) {
  element = document.createElement(type);
  append_to.append(element);
  element.append(text);

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

function get_stop_data() {
  const url = 'mtr_bus_stops.csv';

  fetch(url)
    .then(response => response.text())
    .then(text => {
      stops_data = $.csv.toArrays(text);
      stops_data.splice(0, 1);

      let route_list = [];
      stops_data.filter((x) => {
        if (route_list.indexOf(x[0]) == -1) {
          route_list.push(x[0]);
          $('#route').append('<option value="' + x[0] + '">' + x[0] + '</option>');
        }
      })
    });
}

function refresh_dir() {
  lang = $('#stop_lang').val();

  stops_out = stops_data.filter((x) => {
    return x[0] === $('#route').val() && x[1] === 'O';
  });

  term_out = stops_out[stops_out.length - 1];
  opt_html = '<option value="O">' + term_out[lang] + '</option>';

  stop_next_index = stops_data.indexOf(term_out) + 1;
  stop_next = stops_data[stop_next_index];

  let condition = [
    stop_next[0] === $('#route').val(),
    stop_next[1] === 'I'
  ];

  if (condition.every(x => x)) {
    stops_in = stops_data.filter((x) => {
      return x[0] === $('#route').val() && x[1] === 'I';
    });

    term_in = stops_in[stops_in.length - 1];
    opt_html += '<option value="I">' + term_in[lang] + '</option>';
  } else {
    term_in = undefined;
  }
  
  $('#direction').html(opt_html);
  get_eta_data();
}

function get_eta_data() {
  const url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule';
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'language': 'zh',
      'routeName': $('#route').val()
    })
  };

  fetch(url, init)
    .then(response => response.text())
    .then(text => {
      last_update = new Date();
      eta_data = JSON.parse(text);
      if ($('#direction').val() === 'O') {
        refresh_output(stops_out);
      } else {
        refresh_output(stops_in);
      }
    });
}

function refresh_output(stops) {
  lang = $('#stop_lang').val();
  
  $('#route_title').text('Route ' + $('#route').val() + ' - ' + stops[stops.length - 1][lang]);
  $('#last_update').text(last_update.toLocaleString('en-GB'));
  $('#card_eta').text('');

  for (let stop_index = 0; stop_index < stops.length; stop_index++) {
    table = document.createElement('table');
    $('#card_eta').append(table);

    row = document.createElement('tr');
    table.append(row);
    create('th', stop_index + '. ' + stops[stop_index][lang], row, ['colspan', '3']);

    route_eta = eta_data['busStop'];
    
    if (route.length > 0) {
      stop_eta = route_eta.filter((x) => { return x['busStopId'] === stops[stop_index][3] });

      if (stop_eta.length > 0) {
        stop_eta = stop_eta[0]['bus'];
      }
    } else {
      stop_eta = [];
    }
    
    for (let i = 0; i < stop_eta.length; i++) {
      let condition = [
        $('#show_scheduled').is(':checked'),
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
          eta = Math.floor(secs / 60).toString() + 'm ' + (secs % 60).toString() + 's';
        } else if (secs > 0) {
          eta = secs + 's';
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
      create('td', 'No upcoming departure', row, ['colspan', '3']);
    }
  };
  
  if ($('#show_scheduled').is(':disabled')) {
    $('#card_eta').show();
    $('#show_scheduled').prop('disabled', 0);
    $('#refresh').prop('disabled', 0);
    $('#auto_refresh').prop('disabled', 0);
  }
}

$(() => {
  $('.card:not(#card_init)').hide();
  $('#show_scheduled').prop('disabled', 1);
  $('#refresh').prop('disabled', 1);
  $('#auto_refresh').prop('disabled', 1);
  get_stop_data();
  auto_refresh($('#auto_refresh').val());

  setTimeout(() => {
    $('#card_init').remove();
    $('.card:not(#card_eta)').show();
    refresh_dir();
  }, 900)
});

$('#route').on('change', () => {
  auto_refresh($('#auto_refresh').val());
  refresh_dir();
});

$('#direction').on('change', () => {
  auto_refresh($('#auto_refresh').val());
  get_eta_data();
});

$('#auto_refresh').on('change', () => {
  auto_refresh($('#auto_refresh').val());
});

$('#stop_lang').on('change', () => {
  lang = $('#stop_lang').val();
  opt_html = '<option value="O">' + term_out[lang] + '</option>';
  
  if (typeof term_in !== 'undefined') {
    term_in = stops_in[stops_in.length - 1];
    opt_html += '<option value="I">' + term_in[lang] + '</option>';
  }
  
  $('#direction').html(opt_html);
  
  if ($('#direction').val() === 'O') {
    refresh_output(stops_out);
  } else {
    refresh_output(stops_in);
  }
});

$('#refresh').click(() => {
  auto_refresh($('#auto_refresh').val());
  get_eta_data();
});

$('#show_scheduled').click(() => {
  if ($('#direction').val() === 'O') {
    refresh_output(stops_out);
  } else {
    refresh_output(stops_in);
  }
});