var eta_data, stops_data, timer;

function create(type, text, append_to, ...attributes){
  element = document.createElement(type);
  append_to.append(element);
  element.append(document.createTextNode(text));

  if (typeof attributes !== 'undefined') {
    for (i in attributes) {
      element.setAttribute(attributes[i][0], attributes[i][1]);
    }
  }
}

function auto_refresh(timeout) {
  timer = setTimeout(() => {
    if ($('#direction').val() === 'O') {
      refresh_output(stops_out);
    } else {
      refresh_output(stops_in);
    }
  }, timeout);
}

function clear_refresh() {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
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
      eta_data = JSON.parse(text);
      if ($('#direction').val() === 'O') {
        refresh_output(stops_out);
      } else {
        refresh_output(stops_in);
      }
    });
}

function refresh_dir() {
  stops_out = stops_data.filter((x) => {
    return x[0] === $('#route').val() && x[1] === 'O';
  });

  term_out = stops_out[stops_out.length - 1];
  opt_html = '<option value="O">' + term_out[7] + '</option>';

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
    opt_html += '<option value="I">' + term_in[7] + '</option>';
  }

  $('#direction').html(opt_html);
  get_eta_data();
}

function refresh_output(stops) {
  last_update = new Date(eta_data['routeStatusTime']);
  
  $('#route_title').text('Route ' + $('#route').val() + ' - ' + stops[stops.length - 1][7]);
  $('#last_update').text('Data updated at: ' + last_update.toLocaleTimeString('en-GB'));
  $('#result').text('');
  
  for (let i = 0; i < stops.length; i++) {
    table = document.createElement('table');
    $('#result').append(table);
    
    row = document.createElement('tr');
    table.append(row);
    create('td', i + '. ' + stops[i][7], row, ['colspan', '3']);
    
    stop_eta = eta_data['busStop'];
    
    if (stop_eta.length > 0) {
      stop_eta = stop_eta.filter((x) => { return stops[i][3] === x['busStopId'] });
      
      for (let x of stop_eta[0]['bus']) {
        let condition = [
          $('#show_scheduled').is(':checked'),
          x['isScheduled'] == '0'
        ];
          
        if (condition.some(x => x)) {
          secs = parseInt(x['departureTimeInSecond']);
            
          if (secs > 0) {
            time = new Date(last_update);
            time.setSeconds(time.getSeconds() + secs);
            
            if (secs > 59) {
              eta = Math.floor(secs / 60).toString() + 'm ' + (secs % 60).toString() + 's';
            } else {
              eta = secs + 's';
            }
            
            row = document.createElement('tr');
            table.append(row);
            
            if (x['isScheduled'] == '1') {
              row.setAttribute('class', 'scheduled');
            } else if (secs < 59) {
              row.setAttribute('class', 'arriving');
            } else {
              row.setAttribute('class', 'normal');
            }
            
            create('td', x['busId'], row);
            create('td', time.toLocaleTimeString('en-GB'), row);
            create('td', eta, row);
          }
        };
      }
    }
    
    if (table.rows.length == 1) {
      row = document.createElement('tr');
      table.append(row);
      create('td', 'No departure', row, ['colspan', '3']);
    }
  };
  
  let refresh_second = $('#auto_refresh').val();
  if (refresh_second > 0) {
    auto_refresh(refresh_second * 1000);
  }

  if ($('#result').is(':hidden')) {
    $('#result').addClass('result');
    $('#result').show();
    $('#show_scheduled').prop('disabled', 0);
    $('#refresh').prop('disabled', 0);
    $('#auto_refresh').prop('disabled', 0);
  }
}

$(() => {
  $('.screen > div:not(#init)').hide();

  $('#show_scheduled').prop('disabled', 1);
  $('#refresh').prop('disabled', 1);
  $('#auto_refresh').prop('disabled', 1);
  get_stop_data();

  setTimeout(() => {
    $('#init').remove();
    $('.screen > div').show();
    refresh_dir();
  }, 900)
});

$('#route').on('change', () => {
  clear_refresh();
  refresh_dir();
});

$('#direction').on('change', () => {
  clear_refresh();
  get_eta_data();
});

$('#auto_refresh').on('change', () => {
  clear_refresh();
  let refresh_second = $('#auto_refresh').val();
  if (refresh_second > 0) {
    auto_refresh(refresh_second * 1000);
  }
});

$('#refresh').click(() => {
  clear_refresh();
  get_eta_data();
});

$('#show_scheduled').click(() => {
  if ($('#direction').val() === 'O') {
    refresh_output(stops_out);
  } else {
    refresh_output(stops_in);
  }
});