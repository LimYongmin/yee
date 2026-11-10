import argparse
import math
import os
import re
import sys
import time
from pathlib import Path

import httpx
import serial
from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client


RAW_VALUE_PATTERN = re.compile(r"\bRaw:\s*(-?(?:\d+(?:\.\d*)?|\.\d+))", re.IGNORECASE)


def parse_value(line: str) -> float | None:
    line = line.strip()
    if not line:
        return None

    match = RAW_VALUE_PATTERN.search(line)
    value_text = match.group(1) if match else line
    try:
        value = float(value_text)
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read Arduino values from a serial port and upload them to Supabase."
    )
    parser.add_argument(
        "--port",
        default="COM4",
        help="Arduino serial port (default: COM4)",
    )
    args = parser.parse_args()

    load_dotenv(Path(__file__).with_name(".env"), override=True)
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        return 1

    client = create_client(supabase_url, supabase_key)
    reported_upload_errors: set[str] = set()
    reported_upload_success = False
    try:
        with serial.Serial(args.port, baudrate=9600, timeout=0.1) as arduino:
            buffer = bytearray()
            latest_value = None
            next_output = time.monotonic() + 1
            while True:
                chunk = arduino.read(arduino.in_waiting or 1)
                if chunk:
                    buffer.extend(chunk)
                    while b"\n" in buffer:
                        raw_line, _, remainder = buffer.partition(b"\n")
                        buffer[:] = remainder
                        line = raw_line.decode("utf-8", errors="replace").strip()
                        value = parse_value(line)
                        if value is not None:
                            latest_value = value

                now = time.monotonic()
                if now >= next_output:
                    if latest_value is not None:
                        print(f"{latest_value:g}", flush=True)
                        try:
                            client.table("readings").insert(
                                {"value": latest_value}
                            ).execute()
                            if not reported_upload_success:
                                print(
                                    "Supabase upload succeeded.",
                                    file=sys.stderr,
                                    flush=True,
                                )
                                reported_upload_success = True
                        except httpx.RequestError:
                            message = (
                                "Network error while uploading to Supabase; "
                                "check the internet connection."
                            )
                            if message not in reported_upload_errors:
                                print(message, file=sys.stderr, flush=True)
                                reported_upload_errors.add(message)
                        except APIError as error:
                            message = " ".join(
                                part
                                for part in (
                                    error.message,
                                    error.hint,
                                    error.details,
                                )
                                if part
                            ) or "Supabase rejected the insert."
                            if message not in reported_upload_errors:
                                print(
                                    f"Supabase upload error: {message}",
                                    file=sys.stderr,
                                    flush=True,
                                )
                                reported_upload_errors.add(message)
                        latest_value = None

                    next_output += max(1, int(now - next_output) + 1)
    except KeyboardInterrupt:
        return 0
    except serial.SerialException:
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
