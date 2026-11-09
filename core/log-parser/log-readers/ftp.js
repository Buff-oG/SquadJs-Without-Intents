import path from 'path';
import { FTPTail } from 'ftp-tail';

export default class TailLogReader {
  constructor(queueLine, options = {}) {
    for (const option of ['ftp', 'logDir'])
      if (!(option in options)) throw new Error(`${option} must be specified.`);

    this.options = options;

    this.reader = new FTPTail({
      ftp: options.ftp,
      fetchInterval: options.fetchInterval || 0,
      maxTempFileSize: options.maxTempFileSize || 5 * 1000 * 1000 // 5 MB
    });

    if (typeof queueLine !== 'function')
      throw new Error('queueLine argument must be specified and be a function.');

    this.reader.on('line', queueLine);
  }

  async watch() {
    await this.reader.watch(
      path.join(this.options.logDir, this.options.filename).replace(/\\/g, '/')
    );
  }

  async unwatch() {
    await this.reader.unwatch();
  }
}
