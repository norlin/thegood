Block.prototype.blocks.countdown = function () {
	var block = this,
		app = this.app,
		$node = block.$element,
		finishDate = new Date(block.params.date),
		countdown = {
			textStart: block.params.textStart || 'Власть жуликов и воров кончится через',
			textEnd: block.params.textEnd || 'Всё зависит только от нас!',
			textFinish: block.params.textEnd || 'Россия без путина!'
		};

	function lastStanding() {
		var	nowDate = new Date(),
			seconds,
			minutes,
			hours;

		seconds = (finishDate.getTime() - nowDate.getTime()) / 1000;
		if (seconds > 0) {
			minutes = Math.floor(seconds / 60);
			seconds = Math.floor(seconds - (minutes * 60));
			hours = Math.floor(minutes / 60);
			minutes = Math.floor(minutes - (hours * 60));

			countdown.hours = hours;
			countdown.hoursWord = wordEnd(['часов', 'часа', 'час'], hours);
			countdown.minutes = minutes;
			countdown.minutesWord = wordEnd(['минут', 'минуты', 'минута'], minutes);
			countdown.seconds = seconds;
			countdown.secondsWord = wordEnd(['секунд', 'секунды', 'секунда'], seconds);
		} else {
			countdown.done = true;
		}

		app.render('countdown', {countdown:countdown}, function (err,html) {
			if (!err) {
				$node.html(html);
			}
		});
	}

	window.setInterval(lastStanding, 1000);
	lastStanding();
};