import 'dotenv/config';
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'node-app',
  brokers: process.env.KAFKA_BROKERS.split(','),
});

const producer = kafka.producer();

(async () => {
  try {
    await producer.connect();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Kafka Producer Connection Error:', error);
  }
})();

export { kafka, producer };
