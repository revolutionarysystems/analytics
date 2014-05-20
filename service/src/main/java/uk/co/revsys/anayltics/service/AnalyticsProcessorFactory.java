package uk.co.revsys.anayltics.service;

import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessor;
import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessorFactory;

public class AnalyticsProcessorFactory implements IRecordProcessorFactory{

	@Override
	public IRecordProcessor createProcessor() {
		return new AnalyticsProcessor();
	}

}
