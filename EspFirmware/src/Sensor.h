#ifndef SENSOR_H
#define SENSOR_H

#include <Arduino.h>

#define CLOCK_PIN 5
#define ANALOG_PIN A0

class Sensor
{
private:
    int numberOfValues = 50;
    int values[50];
    long sum = 0;
    int counter = 0;
    int value = 0;

public:
    Sensor();

    /**
     * Measures the soil moisture.
     * Has to be called at least 50 times before the first valid measurement is available.
     * Function calls should be as fast as possible.
     *
     * @return The soil moisture value or -1 if the measurement is not valid.
     * The soil moisture is in the range of 0 to 1024, where 0 is dry and 1024 is wet.
     */
    int measure();
};

#endif