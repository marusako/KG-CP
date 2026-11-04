//! パッドの読み取り間隔と時刻を測る試作（スパイク）。
//!
//! 使い方: `cargo run --release -- gilrs [秒数]`
//! 実行中にスティックをぐるぐる回したり、ボタンを連打したりする。
//! 終わると、イベントの間隔の分布と、イベントが作られてから受け取るまでの遅れを出す。

use std::collections::BTreeMap;
use std::time::{Duration, Instant, SystemTime};

/// 1 つのイベントの記録
struct Sample {
    /// こちらが受け取った時刻
    received: Instant,
    /// ライブラリがイベントを作ってから、こちらが受け取るまで（取れなければ None）
    queue_delay: Option<Duration>,
    /// ボタンが押されたイベントか
    is_press: bool,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mode = args.get(1).map(String::as_str).unwrap_or("gilrs");
    let seconds: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(15);
    let samples = match mode {
        "gilrs" => probe_gilrs(seconds),
        other => {
            eprintln!("知らないモード: {other}（使えるのは gilrs）");
            std::process::exit(2);
        }
    };
    report(mode, &samples);
}

fn probe_gilrs(seconds: u64) -> Vec<Sample> {
    let mut gilrs = gilrs::Gilrs::new().expect("gilrs を初期化できませんでした");
    println!("== gilrs: つながっているパッド ==");
    for (id, pad) in gilrs.gamepads() {
        println!("  {id}: {}（{:?}）", pad.name(), pad.power_info());
    }
    println!("{seconds} 秒間、スティックを回したりボタンを連打したりしてください…");

    let mut samples = Vec::new();
    let end = Instant::now() + Duration::from_secs(seconds);
    while Instant::now() < end {
        while let Some(ev) = gilrs.next_event() {
            let received = Instant::now();
            let queue_delay = SystemTime::now().duration_since(ev.time).ok();
            let is_press = matches!(ev.event, gilrs::EventType::ButtonPressed(..));
            samples.push(Sample { received, queue_delay, is_press });
        }
        // 0.5ms ごとに見に行く（こちら側の読み取りで遅れを足さないため）
        std::thread::sleep(Duration::from_micros(500));
    }
    samples
}

/// 集計して表示する
fn report(mode: &str, samples: &[Sample]) {
    println!();
    println!("== 結果（{mode}） ==");
    println!("イベント数: {}（うちボタンの押下 {}）", samples.len(), samples.iter().filter(|s| s.is_press).count());
    if samples.len() < 2 {
        println!("イベントが少なすぎて集計できません。パッドを動かしてください。");
        return;
    }

    // 続けて動かしている間のイベントの間隔（100ms 以上あいたものは「止まっていた」として除く）
    let gaps: Vec<f64> = samples
        .windows(2)
        .map(|w| (w[1].received - w[0].received).as_secs_f64() * 1000.0)
        .filter(|&ms| ms > 0.05 && ms < 100.0)
        .collect();
    println!();
    println!("イベントの間隔（ms、1ms ごとの分布。同じ時刻に届いたものは除く）:");
    let mut hist: BTreeMap<u64, usize> = BTreeMap::new();
    for ms in &gaps {
        *hist.entry((*ms as u64).min(20)).or_default() += 1;
    }
    for (bucket, count) in &hist {
        let label = if *bucket == 20 { "20〜".to_string() } else { format!("{bucket}〜{}", bucket + 1) };
        let bar = "#".repeat((*count * 60 / gaps.len().max(1)).max(1));
        println!("  {label:>6} ms: {count:>5} {bar}");
    }
    if let Some(min) = gaps.iter().cloned().reduce(f64::min) {
        println!("  いちばん短い間隔: {min:.2} ms");
    }

    let mut delays: Vec<f64> = samples.iter().filter_map(|s| s.queue_delay).map(|d| d.as_secs_f64() * 1000.0).collect();
    delays.sort_by(|a, b| a.partial_cmp(b).unwrap());
    if !delays.is_empty() {
        let p = |q: f64| delays[((delays.len() - 1) as f64 * q) as usize];
        println!();
        println!("イベントが作られてから受け取るまで（ms）: 中央値 {:.2} / 95% {:.2} / 最大 {:.2}", p(0.5), p(0.95), p(1.0));
    }
    println!();
    println!("読み方: 間隔が 8ms や 10ms の倍数に固まっていれば、ライブラリがその間隔で見に行っている。");
    println!("        1〜4ms に散らばっていれば、パッドから届くたびに受け取れている。");
}
