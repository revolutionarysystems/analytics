package uk.co.revsys.anayltics.service;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.internal.StaticCredentialsProvider;
import com.amazonaws.services.kinesis.clientlibrary.lib.worker.KinesisClientLibConfiguration;
import com.amazonaws.services.kinesis.clientlibrary.lib.worker.Worker;
import java.io.IOException;
import java.net.InetAddress;
import java.util.UUID;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

public class AnalyticsService {

	private static final Log LOG = LogFactory.getLog(AnalyticsService.class);

	public static void main(String[] args) throws IOException {
		AnalyticsProcessorFactory analyticsProcessorFactory = new AnalyticsProcessorFactory();
		java.security.Security.setProperty("networkaddress.cache.ttl" , "60");
        String workerId = InetAddress.getLocalHost().getCanonicalHostName() + ":" + UUID.randomUUID();
        LOG.info("Using workerId: " + workerId);
		String awsAccessKey = "AKIAJPF37UIMUME4ZN6A";
		String awsSecretKey = "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";
		AWSCredentialsProvider credentialsProvider = new StaticCredentialsProvider(new BasicAWSCredentials(awsAccessKey, awsSecretKey));
		KinesisClientLibConfiguration kinesisClientLibConfiguration = new KinesisClientLibConfiguration("AnalyticsService", "analytics", credentialsProvider, workerId);
		Worker worker = new Worker(analyticsProcessorFactory, kinesisClientLibConfiguration);
		worker.run();
	}
}
