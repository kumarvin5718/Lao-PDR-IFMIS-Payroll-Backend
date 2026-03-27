package com.ifmis.payroll.service.employeeMaster;

import com.ifmis.payroll.dto.EmployeeRequestDto;
import com.ifmis.payroll.dto.EmployeeResponseDto;

public interface EmployeeMasterService {


    EmployeeResponseDto createEmployee(EmployeeRequestDto request);

}