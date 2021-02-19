$(window).ready(function () {
  var week = 0
  var start = 1536744000000
  var interval = 604800000
  var d = new Date()
  var cTime = d.getTime()
  var diff = cTime - start
  if (diff > 0) week = Math.ceil(diff / interval)

  if (week <= 17)
    $("tbody#schedule")[0].children[week].classList.add("date-highlight")
})
