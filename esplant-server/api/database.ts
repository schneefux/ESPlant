import sqlite3 from 'sqlite3';
import { Data, DatabaseObject, Sensor } from './types/data';

const create_sensor_table_statement = `CREATE TABLE IF NOT EXISTS sensor (
  sensor_address INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT "new sensor"
  );`;

const create_data_table_statement = `CREATE TABLE IF NOT EXISTS data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_address INTEGER NOT NULL,
  date INTEGER NOT NULL,
  water INTEGER NOT NULL,
  FOREIGN KEY (sensor_address) REFERENCES sensor(sensor_address)
  );`;

const create_migration_table_statement = `CREATE TABLE IF NOT EXISTS migration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`;

const migrations = [
  {
    name: 'data_date_timestamp_to_integer',
    statements: [
      // migrate data table replace date timestamp with integer
      // create new table
      `CREATE TABLE IF NOT EXISTS data_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_address INTEGER NOT NULL,
      date INTEGER NOT NULL,
      water INTEGER NOT NULL,
      FOREIGN KEY (sensor_address) REFERENCES sensor(sensor_address)
      );`,
      // copy data to new table
      `INSERT INTO data_new (id, sensor_address, date, water)
      SELECT id, sensor_address, strftime('%s', date), water FROM data;`,
      // drop old table
      'DROP TABLE data;',
      // rename new table
      'ALTER TABLE data_new RENAME TO data;'
    ]
  },
  {
    name: 'data_date_seconds_to_milliseconds',
    statements: [
      // migrate data table replace date seconds with milliseconds
      // create new table
      `CREATE TABLE IF NOT EXISTS data_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_address INTEGER NOT NULL,
      date INTEGER NOT NULL,
      water INTEGER NOT NULL,
      FOREIGN KEY (sensor_address) REFERENCES sensor(sensor_address)
      );`,
      // copy data to new table
      `INSERT INTO data_new (id, sensor_address, date, water)
      SELECT id, sensor_address, date * 1000, water FROM data;`,
      // drop old table
      'DROP TABLE data;',
      // rename new table
      'ALTER TABLE data_new RENAME TO data;'
    ]
  },
  {
    name: 'data_add_voltage_and_duration_integers',
    statements: [
      // migrate data table add voltage and duration columns
      // create new table
      `CREATE TABLE IF NOT EXISTS data_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_address INTEGER NOT NULL,
      date INTEGER NOT NULL,
      water INTEGER NOT NULL,
      voltage INTEGER,
      duration INTEGER,
      FOREIGN KEY (sensor_address) REFERENCES sensor(sensor_address)
      );`,
      // copy data to new table
      `INSERT INTO data_new (id, sensor_address, date, water)
      SELECT id, sensor_address, date, water FROM data;`,
      // drop old table
      'DROP TABLE data;',
      // rename new table
      'ALTER TABLE data_new RENAME TO data;'
    ]
  },
  {
    name: 'data_add_rssi_integer',
    statements: [
      // migrate data table add rssi column
      // create new table
      `CREATE TABLE IF NOT EXISTS data_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_address INTEGER NOT NULL,
      date INTEGER NOT NULL,
      water INTEGER NOT NULL,
      voltage INTEGER,
      duration INTEGER,
      rssi INTEGER,
      FOREIGN KEY (sensor_address) REFERENCES sensor(sensor_address)
      );`,
      // copy data to new table
      `INSERT INTO data_new (id, sensor_address, date, water, voltage, duration)
      SELECT id, sensor_address, date, water, voltage, duration FROM data;`,
      // drop old table
      'DROP TABLE data;',
      // rename new table
      'ALTER TABLE data_new RENAME TO data;'
    ]
  },
];

const DB_SOURCE = '../data/sensor.sqlite';


/**
 * The database connection.
 */
const db = new sqlite3.Database(DB_SOURCE, async (err) => {
  if (err) {
    console.log(err.message);
    throw err;
  } else {
    console.log('Connected to SQLite database');
    // create sensor table if not exists
    dbRun(create_sensor_table_statement, []).catch((err) => {
      console.log(err.message);
    });
    // create data table if not exists
    dbRun(create_data_table_statement, []).catch((err) => {
      console.log(err.message);
    });
    // create migration table if not exists
    dbRun(create_migration_table_statement, []).catch((err) => {
      console.log(err.message);
    });
    console.log('Created tables');
    // migrate data table, if necessary
    for (let migrationIndex = 0; migrationIndex < migrations.length; migrationIndex++) {
      const migration = migrations[migrationIndex];
      console.log(`Checking migration ${migration.name} ${migrationIndex + 1}/${migrations.length}`);
      const migrationExists = await dbGet<{ id: number }>('SELECT id FROM migration WHERE id = ?', [migrationIndex + 1]);
      if (!migrationExists) {
        console.log(`Migrating ${migration.name}`);
        for (const statement of migration.statements) {
          await dbRun(statement, []);
        }
        await dbRun('INSERT INTO migration (name) VALUES (?)', [migration.name]);
        console.log(`Migrated ${migration.name}`);
      }
    }
  }
});

/**
 * Execute a query and return one row.
 * @param query The query to execute.
 * @param params The parameters to use in the query.
 * @returns One row or null if query fails.
 */
function dbGet<T>(query: string, params: unknown[]): Promise<T | null> {
  return new Promise((resolve) => {
    db.get(query, params, (err, row) => {
      if (err) {
        resolve(null);
      } else {
        resolve(row as T);
      }
    });
  });
}

/**
 * Execute a query and return all rows.
 * @param query The query to execute.
 * @param params The parameters to use in the query.
 * @returns List of rows or error if query fails.
 */
function dbAll<T extends DatabaseObject>(query: string, params: unknown[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

/**
 * Execute a query and return the last inserted id.
 * @param query The query to execute.
 * @param params The parameters to use in the query.
 * @returns Last inserted id or error if query fails.
 */
function dbInsert(query: string, params: unknown[]): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

/**
 * Execute a query and return nothing.
 * Used to create tables.
 * @param query The query to execute.
 * @param params The parameters to use in the query.
 * @returns Nothing or error if query fails.
 */
function dbRun(query: string, params: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(query, params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get sensor by address.
 * @param sensorAddress The address of the sensor.
 * @returns The sensor or throws an error if the sensor does not exist.
 */
export function getSensorById(sensorAddress: number) {
  return dbGet<Sensor>('SELECT * FROM sensor WHERE sensor_address = ?', [sensorAddress]);
}

/**
 * Get all sensors.
 * @returns All sensors.
 */
export function getSensors() {
  return dbAll<Sensor>('SELECT * FROM sensor', []);
}

/**
 * 
 * @param sensorAddress The address of the sensor.
 * @param name The name of the sensor.
 * @returns The row id or throws an error if the sensor already exists.
 */
export async function createSensorWithId(sensorAddress: number, name = 'new sensor') {
  const sensor = await getSensorById(sensorAddress);
  if (sensor) {
    return Promise.reject('Sensor already exists');
  }
  return await dbInsert('INSERT INTO sensor (sensor_address, name) VALUES (?, ?)', [sensorAddress, name]);
}

/**
 * Add data to the database.
 * @param sensorAddress The address of the sensor.
 * @param water The water level.
 * @param voltage The battery voltage.
 * @param duration The duration of the measurement.
 * @returns The id of the inserted data or throws an error if the sensor does not exist.
 */
export function addDataBySensorId(sensorAddress: number, water: number, voltage: number, duration: number, rssi: number) {
  const nowMs = Date.now();
  return dbInsert('INSERT INTO data (sensor_address, water, voltage, duration, date, rssi) VALUES (?, ?, ?, ?, ?, ?)', [sensorAddress, water, voltage, duration, nowMs, rssi]);
}

/**
 * Takes a list of data points and averages them to the specified limit.
 * The average of "water", "voltage", and "duration" are calculated.
 * The average of "date" is the last date.
 * If the limit is greater than the number of data points, the original data is returned.
 * @param data The list of data to average.
 * @param limit The final number of data points.
 * @returns The averaged data.
 */
function dataToAverage(data: Data[], limit: number) {
  if (data.length <= limit) {
    return data;
  }
  const averagedData: Data[] = [];
  const step = Math.floor(data.length / limit);
  for (let i = 0; i < data.length; i += step) {
    const dataSlice = data.slice(i, i + step);
    const water = dataSlice.reduce((acc, cur) => acc + cur.water, 0) / dataSlice.length;
    const voltage = dataSlice.reduce((acc, cur) => acc + cur.voltage, 0) / dataSlice.length;
    const duration = dataSlice.reduce((acc, cur) => acc + cur.duration, 0) / dataSlice.length;
    // make a copy of the last data point and change the values
    const averagedDataPoint: Data = { ...dataSlice[dataSlice.length - 1], water, voltage, duration };
    averagedData.push(averagedDataPoint);
  }
  return averagedData;
}

/**
 * Get data by sensor address. Newest data first.
 * @param sensorAddress The address of the sensor.
 * @param startDate The start date in ms since epoch. (optional)
 * @param endDate The end date in ms since epoch. (optional)
 * @param maxDataPoints The maximum number of data points. (optional)
 * @returns The data or an empty list if sensor does not exist.
 */
export async function getDataBySensorId(sensorAddress: number, startDate?: number, endDate?: number, maxDataPoints?: number): Promise<Data[]> {
  // if maxDataPoints and startDate and endDate, return maxDataPoints averaged data points between startDate and endDate
  if (maxDataPoints && startDate && endDate) {
    const data = await dbAll<Data>('SELECT * FROM data WHERE sensor_address = ? AND date >= ? AND date <= ? ORDER BY date DESC', [sensorAddress, startDate, endDate]);
    return dataToAverage(data, maxDataPoints);
  }
  // if maxDataPoints and startDate, return maxDataPoints averaged data points after startDate
  if (maxDataPoints && startDate) {
    const data = await dbAll<Data>('SELECT * FROM data WHERE sensor_address = ? AND date >= ? ORDER BY date DESC', [sensorAddress, startDate]);
    return dataToAverage(data, maxDataPoints);
  }
  // if maxDataPoints and endDate, return maxDataPoints before endDate
  if (maxDataPoints && endDate) {
    return await dbAll<Data>('SELECT * FROM data WHERE sensor_address = ? AND date <= ? ORDER BY date DESC LIMIT ?', [sensorAddress, endDate, maxDataPoints]);
  }
  // if only maxDataPoints, return the last maxDataPoints
  if (maxDataPoints) {
    return await dbAll<Data>('SELECT * FROM data WHERE sensor_address = ? ORDER BY date DESC LIMIT ?', [sensorAddress, maxDataPoints]);
  }
  // if only startDate, return all data points after startDate
  if (startDate) {
    return await dbAll<Data>('SELECT * FROM data WHERE sensor_address = ? AND date >= ? ORDER BY date DESC', [sensorAddress, startDate]);
  }
  // else return last 100 data points
  return await dbAll<Data>('SELECT * FROM data WHERE sensor_address = ? ORDER BY date DESC LIMIT 100', [sensorAddress]);
}

export function updateSensorById(sensorAddress: number, name: string) {
  return dbRun('UPDATE sensor SET name = ? WHERE sensor_address = ?', [name, sensorAddress]);
}

/**
 * Delete data by sensor address.
 * @param sensorAddress The address of the sensor.
 */
export function deleteDataBySensorId(sensorAddress: number) {
  dbRun('DELETE FROM data WHERE sensor_address = ?', [sensorAddress]).catch((err) => {
    console.log(err.message);
  });
}

/**
 * Delete data by id.
 * @param id The id of the data.
 */
export function deleteDataById(id: number) {
  dbRun('DELETE FROM data WHERE id = ?', [id]).catch((err) => {
    console.log(err.message);
  });
}

/**
 * Delete sensor by sensor address.
 * @param sensorAddress The address of the sensor.
 */
export function deleteSensorById(sensorAddress: number) {
  dbRun('DELETE FROM sensor WHERE sensor_address = ?', [sensorAddress]).catch((err) => {
    console.log(err.message);
  });
}